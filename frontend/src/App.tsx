import { useCallback, useEffect, useRef, useState } from 'react';
import { DollarSign, Moon, Sun, Play, GitCompareArrows, Square, Clock, BarChart3, Sparkles, TrendingDown, Layers, Zap, ArrowRight, Plug } from 'lucide-react';
import { ServerConnect } from './components/benchmark/ServerConnect';
import { TestConfig } from './components/benchmark/TestConfig';
import { ResultsSummary } from './components/benchmark/ResultsSummary';
import { AssessmentCard } from './components/benchmark/AssessmentCard';
import { BenchmarkResults } from './components/benchmark/BenchmarkResults';
import { ROISummary } from './components/benchmark/ROISummary';
import { ComparisonView } from './components/benchmark/ComparisonView';
import { CostTab } from './components/costs/CostTab';
import { OptimizationReport } from './components/optimizer/OptimizationReport';
import { HistoryPanel } from './components/history/HistoryPanel';
import { TraceUpload } from './components/traces/TraceUpload';
import { TraceTimeline } from './components/traces/TraceTimeline';
import { TraceAnalysisCard } from './components/traces/TraceAnalysisCard';
import { TracesList } from './components/traces/TracesList';
import { TraceOptimizationReport } from './components/traces/TraceOptimizationReport';
import type { HistoryEntry } from './lib/history';
import { runAssessment } from './api/client';
import { useServerDiscovery } from './hooks/useServerDiscovery';
import { useBenchmark } from './hooks/useBenchmark';
import { useOptimizer } from './hooks/useOptimizer';
import { useTraces } from './hooks/useTraces';
import type { AssessmentResponse, BenchmarkRequest } from './api/types';

type Tab = 'test' | 'traces' | 'costs' | 'history';

export default function App() {
  const discovery = useServerDiscovery();
  const benchmark = useBenchmark();
  const optimizer = useOptimizer();
  const tracesHook = useTraces();

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    const isDark = saved === 'true';
    if (isDark) document.documentElement.classList.add('dark');
    return isDark;
  });
  const [tab, setTab] = useState<Tab>('test');
  const [selectedModel, setSelectedModel] = useState('');
  const [instructions, setInstructions] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compModel2, setCompModel2] = useState('');
  const [compInstructions2, setCompInstructions2] = useState('');
  const [scoreQuality, setScoreQuality] = useState(false);
  const [judgeModel, setJudgeModel] = useState('');
  const [numRuns, setNumRuns] = useState(1);

  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const assessAbortRef = useRef<AbortController | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (benchmark.result && !benchmark.loading) {
      assessAbortRef.current?.abort();
      const controller = new AbortController();
      assessAbortRef.current = controller;

      setAssessment(null);
      setAssessmentError(null);
      setAssessmentLoading(true);

      runAssessment(benchmark.result, discovery.serverUrl, judgeModel || undefined, controller.signal)
        .then((res) => {
          if (!controller.signal.aborted) {
            if (res.error) {
              setAssessmentError(res.error);
            } else {
              setAssessment(res);
            }
          }
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          if (!controller.signal.aborted) {
            setAssessmentError(e instanceof Error ? e.message : 'Assessment failed');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setAssessmentLoading(false);
        });
    }
  }, [benchmark.result, benchmark.loading]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const [beforeResult, setBeforeResult] = useState<import('./api/types').BenchmarkResponse | null>(null);

  const canRun =
    discovery.connected &&
    selectedModel &&
    prompts.some((p) => p.trim());

  const handleRun = useCallback(() => {
    if (!canRun) return;
    const validPrompts = prompts.filter((p) => p.trim());
    const req: BenchmarkRequest = {
      server_url: discovery.serverUrl,
      model_id: selectedModel,
      provider: discovery.provider,
      instructions,
      temperature,
      max_infer_iters: null,
      prompts: validPrompts.map((p) => ({ input: p, tags: [] })),
      score_quality: scoreQuality,
      judge_model_id: scoreQuality ? judgeModel : undefined,
      num_runs: numRuns,
    };

    optimizer.clear();
    setBeforeResult(null);
    assessAbortRef.current?.abort();
    setAssessment(null);
    setAssessmentError(null);
    setAssessmentLoading(false);

    if (comparisonMode && compModel2) {
      const req2: BenchmarkRequest = {
        ...req,
        model_id: compModel2 || selectedModel,
        instructions: compInstructions2 || instructions,
      };
      benchmark.compare([req, req2]);
    } else {
      benchmark.run(req);
    }
  }, [canRun, prompts, discovery.serverUrl, discovery.provider, selectedModel, instructions, temperature, comparisonMode, compModel2, compInstructions2, benchmark, optimizer, scoreQuality, judgeModel, numRuns]);

  const handleOptimize = useCallback(() => {
    if (!benchmark.result) return;
    optimizer.optimize(
      discovery.serverUrl,
      selectedModel,
      instructions,
      benchmark.result,
    );
  }, [benchmark.result, discovery.serverUrl, selectedModel, instructions, optimizer]);

  const handleApplyInstructions = useCallback((revised: string) => {
    if (benchmark.result) {
      setBeforeResult(benchmark.result);
    }
    setInstructions(revised);

    const validPrompts = prompts.filter((p) => p.trim());
    if (!validPrompts.length || !selectedModel) return;

    const req: BenchmarkRequest = {
      server_url: discovery.serverUrl,
      model_id: selectedModel,
      provider: discovery.provider,
      instructions: revised,
      temperature,
      max_infer_iters: null,
      prompts: validPrompts.map((p) => ({ input: p, tags: [] })),
      score_quality: scoreQuality,
      judge_model_id: scoreQuality ? judgeModel : undefined,
      num_runs: numRuns,
    };
    optimizer.clear();
    benchmark.run(req);
  }, [benchmark, prompts, discovery.serverUrl, discovery.provider, selectedModel, temperature, scoreQuality, judgeModel, numRuns, optimizer]);

  const handleLoadHistoryEntry = useCallback((entry: HistoryEntry) => {
    setSelectedModel(entry.modelId);
    setInstructions(entry.instructions);
    setTab('test');
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('darkMode', String(next));
      return next;
    });
  }, []);

  const hasResults = benchmark.result || benchmark.comparisonResults.length > 0;

  return (
    <div className="h-screen flex flex-col bg-surface-alt">
      {/* Header */}
      <header className="h-14 border-b border-border bg-surface flex items-center px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-text tracking-tight">Promptly</span>
        </div>

        <div className="flex-1" />

        <nav className="flex items-center gap-1 mr-4">
          <TabButton active={tab === 'test'} onClick={() => setTab('test')} label="Benchmark tab">
            <BarChart3 className="w-4 h-4" />
            Benchmark
          </TabButton>
          <TabButton active={tab === 'traces'} onClick={() => { setTab('traces'); tracesHook.fetchTraces(); }} label="Traces tab">
            <Layers className="w-4 h-4" />
            Traces
          </TabButton>
          <TabButton active={tab === 'costs'} onClick={() => setTab('costs')} label="Costs tab">
            <DollarSign className="w-4 h-4" />
            Costs
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} label="History tab">
            <Clock className="w-4 h-4" />
            History
          </TabButton>
        </nav>

        <button
          onClick={toggleDark}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors text-text-muted"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'test' && (
          <>
            {discovery.connected ? (
              <>
                {/* Server Connection — top bar when connected */}
                <div className="border-b border-border bg-surface">
                  <div className="max-w-7xl mx-auto px-6 py-4">
                    <ServerConnect
                      connected={discovery.connected}
                      loading={discovery.loading}
                      error={discovery.error}
                      serverUrl={discovery.serverUrl}
                      status={discovery.status}
                      onConnect={(url, prov) => discovery.discover(url, prov)}
                      onDisconnect={() => {
                        discovery.disconnect();
                        benchmark.clear();
                        optimizer.clear();
                        setSelectedModel('');
                      }}
                    />
                  </div>
                </div>

              <div className="max-w-7xl mx-auto px-6 py-4">
                <div className={`flex gap-5 ${hasResults ? '' : 'max-w-4xl mx-auto'}`}>
                  {/* Left column: Config */}
                  <div className={`space-y-4 shrink-0 ${hasResults ? 'w-[420px]' : 'flex-1'}`}>
                    <TestConfig
                      models={discovery.models}
                      selectedModel={selectedModel}
                      onSelectModel={setSelectedModel}
                      instructions={instructions}
                      onSetInstructions={setInstructions}
                      temperature={temperature}
                      onSetTemperature={setTemperature}
                      prompts={prompts}
                      onSetPrompts={setPrompts}
                      disabled={benchmark.loading}
                      scoreQuality={scoreQuality}
                      onSetScoreQuality={setScoreQuality}
                      judgeModel={judgeModel}
                      onSetJudgeModel={setJudgeModel}
                      numRuns={numRuns}
                      onSetNumRuns={setNumRuns}
                      compact={!!hasResults}
                    />

                    {/* Actions bar */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setComparisonMode(!comparisonMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          comparisonMode
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <GitCompareArrows className="w-4 h-4" />
                        Compare
                      </button>

                      <div className="flex-1" />

                      {benchmark.loading ? (
                        <button
                          onClick={benchmark.cancel}
                          className="px-5 py-2 rounded-lg bg-danger text-white text-sm font-medium
                                     hover:bg-danger/90 transition-colors flex items-center gap-2"
                        >
                          <Square className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={handleRun}
                          disabled={!canRun}
                          className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium
                                     hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                     flex items-center gap-2 shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Run Benchmark
                        </button>
                      )}
                    </div>

                    {comparisonMode && (
                      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Compare Against</p>
                        <select
                          value={compModel2}
                          onChange={(e) => setCompModel2(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-surface-alt text-text text-sm
                                     focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">Same model</option>
                          {discovery.models.map((m) => (
                            <option key={m.id} value={m.id}>{m.display_name || m.id}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={compInstructions2}
                          onChange={(e) => setCompInstructions2(e.target.value)}
                          placeholder="Alt instructions (blank = same)"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-surface-alt text-text text-sm
                                     placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right column: Results */}
                  {hasResults && (
                    <div className="flex-1 min-w-0 space-y-4">
                      {benchmark.error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-danger">
                          {benchmark.error}
                        </div>
                      )}

                      {benchmark.result && (
                        <ResultsSummary
                          result={benchmark.result}
                          onOptimize={handleOptimize}
                          optimizing={optimizer.loading}
                        />
                      )}

                      {benchmark.result && (assessmentLoading || assessment || assessmentError) && (
                        <AssessmentCard
                          assessment={assessment}
                          loading={assessmentLoading}
                          error={assessmentError}
                          onOptimize={handleOptimize}
                          optimizing={optimizer.loading}
                        />
                      )}

                      {benchmark.result && (
                        <OptimizationReport
                          result={optimizer.result}
                          loading={optimizer.loading}
                          error={optimizer.error}
                          onOptimize={handleOptimize}
                          onApplyInstructions={handleApplyInstructions}
                          disabled={!benchmark.result}
                          originalInstructions={instructions}
                        />
                      )}

                      {beforeResult && benchmark.result && !benchmark.loading && (
                        <ROISummary
                          before={beforeResult}
                          after={benchmark.result}
                          onDismiss={() => setBeforeResult(null)}
                        />
                      )}

                      {benchmark.result && (
                        <BenchmarkResults result={benchmark.result} />
                      )}

                      {benchmark.comparisonResults.length > 0 && (
                        <ComparisonView results={benchmark.comparisonResults} />
                      )}
                    </div>
                  )}
                </div>

                {/* Error when no results yet */}
                {benchmark.error && !hasResults && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-danger max-w-4xl mx-auto">
                    {benchmark.error}
                  </div>
                )}

                {/* Empty state when connected but no results */}
                {!benchmark.loading && !hasResults && !benchmark.error && (
                  <div className="flex items-center justify-center py-10 max-w-4xl mx-auto">
                    <div className="flex gap-10 text-center">
                      <StepCard
                        step={1}
                        icon={<BarChart3 className="w-5 h-5 text-primary" />}
                        title="Benchmark"
                        description="Measure token usage per prompt"
                      />
                      <div className="flex items-center text-border">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                      <StepCard
                        step={2}
                        icon={<Sparkles className="w-5 h-5 text-primary" />}
                        title="Optimize"
                        description="AI suggests token reductions"
                      />
                      <div className="flex items-center text-border">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                      <StepCard
                        step={3}
                        icon={<TrendingDown className="w-5 h-5 text-primary" />}
                        title="Save"
                        description="See dollar savings at scale"
                      />
                    </div>
                  </div>
                )}
              </div>
              </>
            ) : (
              /* Disconnected landing — server connect centered on page */
              !discovery.loading && (
                <div className="flex-1 flex items-center justify-center px-6">
                  <div className="w-full max-w-3xl">
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                        <Plug className="w-8 h-8 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-text mb-2">Connect Your LLM Server</h2>
                      <p className="text-sm text-text-muted">
                        Enter your endpoint to benchmark token usage, optimize prompts, and project costs.
                      </p>
                    </div>

                    <ServerConnect
                      connected={discovery.connected}
                      loading={discovery.loading}
                      error={discovery.error}
                      serverUrl={discovery.serverUrl}
                      status={discovery.status}
                      onConnect={(url, prov) => discovery.discover(url, prov)}
                      onDisconnect={() => {
                        discovery.disconnect();
                        benchmark.clear();
                        optimizer.clear();
                        setSelectedModel('');
                      }}
                    />

                    <div className="flex items-center justify-center gap-8 text-sm text-text-muted mt-10">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <span>Benchmark</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>Optimize</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-primary" />
                        <span>Save</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </>
        )}

        {tab === 'traces' && (
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-text">Agent Traces</h2>
              <p className="text-sm text-text-muted mt-1">
                Upload multi-step agent traces to analyze token usage across full workflows.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TraceUpload
                onUpload={tracesHook.upload}
                loading={tracesHook.loading}
              />

              <TracesList
                traces={tracesHook.traces}
                selectedId={tracesHook.selectedTrace?.id ?? null}
                onSelect={tracesHook.selectTrace}
                onDelete={tracesHook.removeTrace}
              />
            </div>

            {tracesHook.error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-danger">
                {tracesHook.error}
              </div>
            )}

            {tracesHook.selectedTrace && tracesHook.analysis && (
              <>
                <TraceAnalysisCard
                  analysis={tracesHook.analysis}
                  onOptimize={() => tracesHook.optimize(tracesHook.selectedTrace!.id)}
                  optimizing={tracesHook.optimizing}
                />

                <TraceTimeline
                  steps={tracesHook.selectedTrace.steps}
                  totalTokens={tracesHook.selectedTrace.total_tokens}
                />

                {tracesHook.optimization && (
                  <TraceOptimizationReport result={tracesHook.optimization} />
                )}
              </>
            )}
          </div>
        )}

        {tab === 'costs' && (
          <div className="max-w-7xl mx-auto px-6 py-6">
            <CostTab
              benchmarkResult={benchmark.result}
              traceTokens={tracesHook.analysis ? {
                input: tracesHook.analysis.total_input_tokens,
                output: tracesHook.analysis.total_output_tokens,
              } : null}
            />
          </div>
        )}

        {tab === 'history' && (
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-text">Optimization History</h2>
              <p className="text-sm text-text-muted mt-1">
                Past benchmark results are saved automatically. Click "Load Config" to re-run a previous test.
              </p>
            </div>
            <HistoryPanel
              onLoadEntry={handleLoadHistoryEntry}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-text-muted hover:text-text hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-text">
          <span className="text-primary mr-1">{step}.</span>{title}
        </div>
        <div className="text-xs text-text-muted mt-1">{description}</div>
      </div>
    </div>
  );
}

