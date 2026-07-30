import { describe, expect, it } from 'vitest'
import {
  buildStepCompareMatrix,
  buildStepDetailTables,
  buildStepIssueFilters,
  buildStepIssues,
  buildStepMetricGroups,
  buildStepTabs,
  buildStepVerdict,
  buildStepWorkspaceChips,
  hasStepIssueEvidence,
  matchesStepIssueFilter,
} from './projectStepAnalysis'
import {
  compareSummaryFixture,
  evidenceFixture,
  metricRecordFixture,
  signoffReadinessFixture,
  stepSnapshotFixture,
  trendSummaryFixture,
  workspaceSummaryFixture,
} from './projectStepAnalysis.fixture'

describe('buildStepIssues', () => {
  it('flattens every finding channel in a fixed reading order', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({
        summaryStatus: 'blocked',
        metrics: [metricRecordFixture({ metricName: 'route_drc_count', unit: 'count' })],
        blockingIssues: [
          {
            step: 'Route',
            metric: 'route_drc_count',
            displayName: 'Routing DRC violations',
            value: 12,
            reason: 'DRC violations remain after detail routing.',
            evidence: evidenceFixture({
              sourceFile: 'analysis/qor_summary.json',
              sourceSelector: 'gates[0]',
              expectedOperator: '<=',
              expectedValue: 0,
              diagnosis: 'Detail routing left 12 shorts on M3.',
            }),
          },
        ],
        hotspots: [
          {
            step: 'Route',
            kind: 'congestion',
            severity: 'warning',
            metric: 'route_overflow',
            displayName: 'Global route overflow',
            value: 3,
            sourceFile: 'analysis/qor_hotspots.json',
            description: 'Overflow concentrated in the top-right region.',
          },
        ],
      }),
    })

    const issues = buildStepIssues(workspace, 'Route')

    expect(issues.map((issue) => issue.channel)).toEqual(['blocking', 'hotspot'])
    expect(issues[0]).toMatchObject({
      kind: 'Blocking issue',
      title: 'Routing DRC violations',
      actual: '12 count',
      expected: '0 count',
      condition: 'route_drc_count <= 0 count',
      location: 'analysis/qor_summary.json#gates[0]',
      diagnosis: 'Detail routing left 12 shorts on M3.',
      // qor_summary.json lists it as blocking but reports no severity for it.
      blocking: true,
      severity: null,
    })
    expect(issues[1]).toMatchObject({
      kind: 'Hotspot: congestion',
      title: 'Global route overflow',
      severity: 'warning',
      blocking: false,
    })
  })

  it('merges a hard gate failure into the blocking issue for the same metric', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({
        blockingIssues: [
          {
            step: 'Route',
            metric: 'route_drc_count',
            displayName: 'Routing DRC violations',
            value: 12,
            reason: 'DRC violations remain.',
            evidence: evidenceFixture(),
          },
        ],
        hardGateFailures: [
          {
            step: 'Route',
            id: 'route_drc_clean',
            kind: 'drc',
            metric: 'route_drc_count',
            threshold: 0,
            actual: 12,
            evidence: evidenceFixture({ diagnosis: 'Hard gate route_drc_clean failed.' }),
          },
        ],
      }),
    })

    const issues = buildStepIssues(workspace, 'Route')

    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe('Blocking issue / failed hard gate')
    expect(issues[0].expected).toBe('0')
    expect(issues[0].diagnosis).toBe('Hard gate route_drc_clean failed.')
  })

  it('reports missing artifacts only when the flow step actually succeeded', () => {
    const succeeded = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({
        hotspotArtifactStatus: 'missing',
        summaryArtifactStatus: 'invalid',
      }),
    })
    const notRun = workspaceSummaryFixture('ws_b', {
      Route: stepSnapshotFixture({
        flowStatus: 'unstart',
        hotspotArtifactStatus: 'missing',
        summaryArtifactStatus: 'invalid',
      }),
    })

    const succeededIssues = buildStepIssues(succeeded, 'Route')
    expect(succeededIssues.map((issue) => issue.source)).toEqual([
      'analysis/qor_summary.json',
      'analysis/qor_hotspots.json',
    ])
    // Neither artifact status carries a severity, so none is invented for them.
    expect(succeededIssues.map((issue) => issue.severity)).toEqual([null, null])
    expect(succeededIssues.map((issue) => issue.blocking)).toEqual([false, false])

    expect(buildStepIssues(notRun, 'Route')).toHaveLength(0)
  })

  it('turns STA timing paths and corner coverage gaps into traceable issues', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      STA: stepSnapshotFixture({
        step: 'STA',
        timingIssues: [
          {
            issueId: 'setup_0',
            workspaceId: 'ws_a',
            workspaceName: 'ws_a',
            severity: 'critical',
            analysisType: 'setup',
            corner: 'ss_0p72v_125c',
            pathGroup: 'clk',
            checkType: 'max',
            slackNs: -0.42,
            launchClockNetworkDelayNs: 1.2,
            captureClockNetworkDelayNs: 1.35,
            clockNetworkDelayDeltaNs: 0.15,
          },
        ],
        timingCoverage: {
          workspaceId: 'ws_a',
          workspaceName: 'ws_a',
          missingCornerCount: 2,
          missingCorners: ['ff_0p88v_m40c', 'tt_0p8v_25c'],
          availableArtifactCount: 1,
        },
      }),
    })

    const issues = buildStepIssues(workspace, 'STA')

    expect(issues[0]).toMatchObject({
      severity: 'critical',
      title: 'SETUP max',
      actual: '-0.42 ns',
      location: 'analysis/sta_timing_issues.json#issue_id=setup_0',
    })
    expect(issues[0].diagnosis).toContain('clock-delay delta 0.15 ns')
    expect(issues[1]).toMatchObject({
      // The coverage gap is counted, not rated: no artifact assigns it a severity.
      severity: null,
      title: 'STA timing corners missing',
      actual: '2 count',
    })
    expect(issues[1].diagnosis).toContain('ff_0p88v_m40c')
  })

  it('leaves the threshold blank when the artifact reports none', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      STA: stepSnapshotFixture({
        step: 'STA',
        timingIssues: [
          {
            issueId: 'setup_0',
            workspaceId: 'ws_a',
            workspaceName: 'ws_a',
            severity: 'critical',
            analysisType: 'setup',
            corner: 'ss_0p72v_125c',
            pathGroup: 'clk',
            checkType: 'max',
            slackNs: -0.42,
            launchClockNetworkDelayNs: null,
            captureClockNetworkDelayNs: null,
            clockNetworkDelayDeltaNs: null,
          },
        ],
        timingCoverage: {
          workspaceId: 'ws_a',
          workspaceName: 'ws_a',
          missingCornerCount: 2,
          missingCorners: ['ff_0p88v_m40c'],
          availableArtifactCount: 1,
        },
      }),
    })

    // sta_timing_issues.json carries no threshold field, so slack >= 0 must not be assumed.
    for (const issue of buildStepIssues(workspace, 'STA')) {
      expect(issue.expected).toBeNull()
      expect(issue.condition).toBeNull()
    }
  })

  it('returns nothing when the step has no analysis snapshot', () => {
    expect(buildStepIssues(workspaceSummaryFixture('ws_a', {}), 'Route')).toEqual([])
    expect(buildStepIssues(null, 'Route')).toEqual([])
  })
})

describe('buildStepIssueFilters', () => {
  const workspace = workspaceSummaryFixture('ws_a', {
    Route: stepSnapshotFixture({
      hotspotArtifactStatus: 'missing',
      blockingIssues: [
        {
          step: 'Route',
          metric: 'route_drc_count',
          displayName: 'Routing DRC violations',
          value: 12,
          reason: 'DRC violations remain.',
          evidence: evidenceFixture(),
        },
      ],
    }),
  })
  const issues = buildStepIssues(workspace, 'Route')

  it('offers one chip per channel actually present', () => {
    expect(
      buildStepIssueFilters(issues).map((filter) => [filter.label, filter.count]),
    ).toEqual([
      ['All', 2],
      ['Blocking issue', 1],
      ['Artifact', 1],
    ])
  })

  it('drops the channel chips when a single channel would duplicate All', () => {
    const single = issues.filter((issue) => issue.channel === 'artifact')

    expect(buildStepIssueFilters(single).map((filter) => filter.id)).toEqual(['all'])
  })

  it('labels a hotspot without an upstream kind as a plain hotspot', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({
        hotspots: [
          {
            step: 'Route',
            kind: null,
            severity: null,
            metric: 'route_overflow',
            displayName: 'Global route overflow',
            value: 3,
            sourceFile: 'feature/route.map.json',
            description: null,
          },
        ],
      }),
    })

    const [issue] = buildStepIssues(workspace, 'Route')

    expect(issue.kind).toBe('Hotspot')
    expect(issue.severity).toBeNull()
    expect(issue.diagnosis).toBeNull()
  })

  it('marks the channels whose artifacts add nothing past the queue row', () => {
    expect(issues.map((issue) => [issue.channel, hasStepIssueEvidence(issue)])).toEqual([
      ['blocking', true],
      ['artifact', false],
    ])
  })

  it('matches by channel and by the blocking flag', () => {
    expect(
      issues.filter((issue) => matchesStepIssueFilter(issue, 'blocking')),
    ).toHaveLength(1)
    expect(
      issues.filter((issue) => matchesStepIssueFilter(issue, 'artifact')),
    ).toHaveLength(1)
    expect(issues.filter((issue) => matchesStepIssueFilter(issue, 'all'))).toHaveLength(2)
  })
})

describe('buildStepVerdict', () => {
  it('reports the artifact, metric, corner, and signoff facts for a signoff step', () => {
    const workspace = workspaceSummaryFixture(
      'ws_a',
      {
        STA: stepSnapshotFixture({
          step: 'STA',
          summaryStatus: 'blocked',
          hotspotArtifactStatus: 'missing',
          metrics: [
            metricRecordFixture({ metricName: 'sta_corner_count', value: 2 }),
            metricRecordFixture({ metricName: 'sta_expected_corner_count', value: 4 }),
          ],
        }),
      },
      signoffReadinessFixture({
        groups: [{ step: 'STA', id: 'sta_setup', status: 'blocked', gate: true }],
      }),
    )
    const issues = buildStepIssues(workspace, 'STA')

    const verdict = buildStepVerdict(workspace, 'STA', issues)

    expect(verdict.status).toBe('blocked')
    expect(verdict.label).toBe('Blocked')
    expect(verdict.summary).toContain('listed as blocking')
    expect(verdict.facts).toEqual(
      expect.arrayContaining([
        { label: 'Artifacts', value: '2/3', tone: 'warn' },
        { label: 'Corners', value: '2/4', tone: 'warn' },
        { label: 'Signoff', value: 'blocked', tone: 'bad' },
      ]),
    )
  })

  it('falls back to a no-data verdict when the step was never analyzed', () => {
    const verdict = buildStepVerdict(workspaceSummaryFixture('ws_a', {}), 'Route', [])

    expect(verdict.status).toBe('no_data')
    expect(verdict.label).toBe('No analysis')
    expect(verdict.facts).toEqual([])
  })

  it('withholds a status when qor_summary.json reported none', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({ summaryStatus: null }),
    })
    const issues = buildStepIssues(workspace, 'Route')

    const verdict = buildStepVerdict(workspace, 'Route', issues)

    expect(verdict.status).toBeNull()
    expect(verdict.label).toBeNull()
    // The measured facts still come through; only the pass/blocked call is withheld.
    expect(verdict.facts.map((fact) => fact.label)).toContain('Artifacts')
  })
})

describe('buildStepMetricGroups', () => {
  it('groups by QoR dimension and scores the baseline delta by polarity', () => {
    const steps = {
      Route: stepSnapshotFixture({
        metrics: [
          metricRecordFixture({
            metricName: 'route_wirelength',
            displayName: 'Total wirelength',
            value: 900,
            unit: 'um',
            polarity: 'lower_is_better',
          }),
          metricRecordFixture({
            metricName: 'route_runtime',
            value: 120,
            dimension: 'runtime',
            unit: 's',
          }),
          metricRecordFixture({ metricName: 'route_internal', stepRole: 'hidden' }),
        ],
      }),
    }
    const workspace = workspaceSummaryFixture('ws_b', steps)
    const baseline = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({
        metrics: [
          metricRecordFixture({
            metricName: 'route_wirelength',
            value: 1000,
            unit: 'um',
          }),
          metricRecordFixture({ metricName: 'route_runtime', value: 100, unit: 's' }),
        ],
      }),
    })

    const groups = buildStepMetricGroups(workspace, baseline, 'Route')

    expect(groups.map((group) => group.label)).toEqual(['Routability', 'Runtime'])
    expect(groups[0].rows).toHaveLength(1)
    expect(groups[0].rows[0]).toMatchObject({
      label: 'Total wirelength',
      value: '900 um',
      descriptor: 'um / lower is better',
      delta: '-100',
      deltaTone: 'good',
    })
    expect(groups[1].rows[0]).toMatchObject({
      delta: '+20',
      deltaTone: 'bad',
    })
  })

  it('marks the baseline workspace itself instead of computing a self delta', () => {
    const steps = {
      Route: stepSnapshotFixture({
        metrics: [metricRecordFixture({ metricName: 'route_wirelength', value: 1000 })],
      }),
    }
    const baseline = workspaceSummaryFixture('ws_a', steps)

    const groups = buildStepMetricGroups(baseline, baseline, 'Route')

    expect(groups[0].rows[0].delta).toBe('base')
    expect(groups[0].rows[0].deltaTone).toBe('neutral')
  })
})

describe('buildStepDetailTables', () => {
  it('renders a registered detail descriptor as labelled columns and flat cells', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      STA: stepSnapshotFixture({
        step: 'STA',
        details: [
          {
            id: 'sta_path_groups',
            presentation: 'path_group_table',
            sourceFile: 'analysis/qor_metrics.json',
            selector: 'details[0]',
            summary: {
              coverage: { status: 'incomplete', expected_count: 4, available_count: 2 },
              records: [
                {
                  corner_context: { label: 'ss_0p72v_125c' },
                  path_group: 'clk',
                  setup: { worst_wns: -0.42, worst_tns: -3.1 },
                  hold: { worst_wns: 0.05 },
                },
              ],
            },
          },
        ],
      }),
    })

    const [table] = buildStepDetailTables(workspace, 'STA')

    expect(table.title).toBe('STA path groups')
    expect(table.columns).toEqual(['PVT / RC corner', 'path group', 'setup', 'hold'])
    expect(table.rows).toEqual([['ss_0p72v_125c', 'clk', '-0.42 / -3.1', '0.05']])
    expect(table.coverage).toEqual({
      label: '2/4 corners',
      status: 'incomplete',
      tone: 'warn',
    })
  })

  it('does not treat an empty DRC detail table as evidence of a clean result', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      DRC: stepSnapshotFixture({
        step: 'DRC',
        metrics: [
          metricRecordFixture({
            step: 'DRC',
            metricName: 'drc_count',
            value: 0,
            unit: 'count',
          }),
        ],
        details: [
          {
            id: 'drc_rules',
            presentation: 'rule_layer_table',
            sourceFile: 'analysis/qor_metrics.json',
            selector: 'details[0]',
            summary: { top_violations: [] },
          },
        ],
      }),
    })

    const [table] = buildStepDetailTables(workspace, 'DRC')

    expect(table.rows).toEqual([])
    expect(table.emptyMessage).toBe('No rule/layer breakdown')
    expect(table.emptyDetail).toBe('DRC count: 0 · Summary: pass')
  })

  it('keeps the DRC detail slot when its optional rule/layer descriptor is missing', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      DRC: stepSnapshotFixture({
        step: 'DRC',
        metrics: [
          metricRecordFixture({
            step: 'DRC',
            metricName: 'drc_count',
            value: 12,
            unit: 'count',
          }),
        ],
      }),
    })

    const [table] = buildStepDetailTables(workspace, 'DRC')

    expect(table).toMatchObject({
      title: 'DRC rules by layer',
      sourceFile: 'analysis/qor_metrics.json',
      rows: [],
      emptyMessage: 'Breakdown unavailable',
      emptyDetail: 'DRC count: 12 · Summary: pass',
    })
  })

  it('withholds the DRC count when the artifact did not report one', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      DRC: stepSnapshotFixture({ step: 'DRC', summaryStatus: 'incomplete' }),
    })

    const [table] = buildStepDetailTables(workspace, 'DRC')

    expect(table.emptyMessage).toBe('DRC count unavailable')
    expect(table.emptyDetail).toBe('Summary: incomplete')
  })
})

describe('buildStepCompareMatrix', () => {
  it('flags the baseline and best columns and derives per-cell deltas', () => {
    const workspaces = [
      workspaceSummaryFixture('ws_a', {
        Route: stepSnapshotFixture({
          metrics: [
            metricRecordFixture({
              metricName: 'route_wirelength',
              unit: 'um',
              polarity: 'lower_is_better',
            }),
          ],
        }),
      }),
      workspaceSummaryFixture('ws_b', {}),
    ]
    const stage = compareSummaryFixture('Route', [
      {
        id: 'route_wirelength',
        label: 'Total wirelength',
        hint: 'shorter is better',
        points: [
          {
            workspaceId: 'ws_a',
            workspaceName: 'ws_a',
            label: '1000 um',
            value: 1000,
            state: 'good',
          },
          {
            workspaceId: 'ws_b',
            workspaceName: 'ws_b',
            label: '1100 um',
            value: 1100,
            state: 'warn',
          },
        ],
      },
    ])

    const matrix = buildStepCompareMatrix(
      stage,
      workspaces,
      trendSummaryFixture([{ workspaceId: 'ws_a' }, { workspaceId: 'ws_b' }], 'ws_a'),
      'ws_b',
      'Route',
    )

    expect(matrix.columns).toEqual([
      { workspaceId: 'ws_a', workspaceName: 'ws_a', isBaseline: true, isBest: false },
      { workspaceId: 'ws_b', workspaceName: 'ws_b', isBaseline: false, isBest: true },
    ])
    expect(matrix.rows[0].descriptor).toBe('um / lower is better')
    expect(matrix.rows[0].cells[0].delta).toBe('base')
    expect(matrix.rows[0].cells[1]).toMatchObject({
      value: '1100 um',
      delta: '+100',
      deltaTone: 'bad',
    })
  })
})

describe('buildStepTabs and buildStepWorkspaceChips', () => {
  it('counts issues per step for the selected workspace', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({
        blockingIssues: [
          {
            step: 'Route',
            metric: 'route_drc_count',
            displayName: 'Routing DRC violations',
            value: 12,
            reason: 'DRC violations remain.',
            evidence: evidenceFixture(),
          },
        ],
      }),
    })

    const tabs = buildStepTabs(
      [compareSummaryFixture('Route'), compareSummaryFixture('DRC')],
      workspace,
    )

    expect(tabs[0]).toEqual({
      step: 'Route',
      blockingCount: 1,
      findingCount: 1,
      analysisAvailability: 'available',
    })
    expect(tabs[1]).toEqual({
      step: 'DRC',
      blockingCount: 0,
      findingCount: 0,
      analysisAvailability: 'unavailable',
    })
  })

  it('describes each workspace with its QoR status tone and issue counts', () => {
    const workspaces = [
      workspaceSummaryFixture('ws_a', {
        Route: stepSnapshotFixture({ hotspotArtifactStatus: 'missing' }),
      }),
      workspaceSummaryFixture('ws_b', { Route: stepSnapshotFixture({}) }),
    ]

    const chips = buildStepWorkspaceChips(
      workspaces,
      trendSummaryFixture(
        [
          { workspaceId: 'ws_a', status: 'Red' },
          { workspaceId: 'ws_b', status: 'Green' },
        ],
        'ws_b',
      ),
      'ws_b',
      'Route',
    )

    expect(chips[0]).toMatchObject({
      tone: 'warn',
      statusLabel: 'Route: 1 findings reported',
      findingCount: 1,
      blockingCount: 0,
      isBaseline: false,
    })
    expect(chips[1]).toMatchObject({
      tone: 'good',
      statusLabel: 'Route analysis clean',
      findingCount: 0,
      blockingCount: 0,
      isBaseline: true,
      isBest: true,
    })
  })

  it('does not mark a snapshot without analysis artifacts as available', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      DRC: stepSnapshotFixture({
        step: 'DRC',
        flowStatus: 'unstart',
        artifactStatus: 'missing',
        summaryArtifactStatus: 'missing',
        hotspotArtifactStatus: 'missing',
        summaryStatus: null,
      }),
    })

    const [tab] = buildStepTabs([compareSummaryFixture('DRC')], workspace)

    expect(tab).toMatchObject({
      step: 'DRC',
      findingCount: 0,
      analysisAvailability: 'unavailable',
    })
  })
})
