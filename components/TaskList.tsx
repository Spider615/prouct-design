import React, { useRef, useState } from 'react';
import { Play, StopCircle, Trash2 } from 'lucide-react';
import { generateContentStream } from '../services/geminiService';
import { GeminiModel } from '../types';

type TaskType = 'TEST' | 'DEBUG';

interface TaskItem {
  id: string;
  name: string;
  type: TaskType;
  collectionName: string; // 兼容测试/调试的数据来源
  version: string;
  nodes: string[]; // 测试可多节点，调试仅一个模型节点
  rounds: number;
  passRate: number; // 0-1
  avgLatencyMs: number;
  progress: number; // 0-1
  createdAt: string;
  debugMode?: 'SINGLE' | 'CONTRAST';
  model?: string;
}

const MOCK_TASKS: TaskItem[] = [
  {
    id: 't1',
    name: 'test',
    type: 'DEBUG',
    collectionName: '调试集A',
    version: '9-v1.0.9',
    nodes: ['大模型生成'],
    rounds: 1,
    passRate: 0.83,
    avgLatencyMs: 720,
    progress: 1,
    createdAt: '2025-11-28 10:21',
    debugMode: 'CONTRAST',
    model: 'Gemini 2.5 Flash',
  },
  {
    id: 't4',
    name: 'test-11111111',
    type: 'DEBUG',
    collectionName: '调试集B',
    version: '9-v1.0.9',
    nodes: ['大模型生成'],
    rounds: 10,
    passRate: 0.83,
    avgLatencyMs: 720,
    progress: 1,
    createdAt: '2025-11-28 10:21',
    debugMode: 'SINGLE',
    model: 'Gemini 2.5 Flash',
  },
  {
    id: 't5',
    name: '调试-单点模式测试',
    type: 'DEBUG',
    collectionName: '调试集C',
    version: 'gemini-2.5-flash',
    nodes: ['大模型生成'],
    rounds: 5,
    passRate: 0.9,
    avgLatencyMs: 600,
    progress: 1,
    createdAt: '2025-11-29 11:00',
    debugMode: 'SINGLE',
    model: 'Gemini 2.5 Flash',
  },
  {
    id: 't2',
    name: '测试-批量回归套件',
    type: 'TEST',
    collectionName: '批量测试集',
    version: '9-v1.0.9',
    nodes: ['大模型生成'],
    rounds: 20,
    passRate: 0.38,
    avgLatencyMs: 930,
    progress: 0.6,
    createdAt: '2025-11-27 16:05',
    model: 'Gemini 2.5 Flash',
  },
  {
    id: 't3',
    name: '测试-阶段性评估',
    type: 'TEST',
    collectionName: '阶段集-11月',
    version: '9-v1.0.9',
    nodes: ['大模型生成'],
    rounds: 20,
    passRate: 0.0,
    avgLatencyMs: 840,
    progress: 0.2,
    createdAt: '2025-11-25 09:40',
    model: 'Gemini 2.5 Flash',
  },
];

const TaskList: React.FC = () => {
  const [view, setView] = useState<'LIST' | 'RESULTS' | 'RESULT_DETAIL'>('LIST');
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [activeResult, setActiveResult] = useState<{
    id: string;
    debuggerName: string;
    resultText: string;
    latencyMs: number;
    status: 'DONE' | 'PENDING' | 'FAILED';
    tokenUsage?: number;
  } | null>(null);
  const tasks = MOCK_TASKS;
  const [resultRows, setResultRows] = useState<{
    id: string;
    debuggerName: string;
    resultText: string;
    latencyMs: number;
    status: 'DONE' | 'PENDING' | 'FAILED';
    tokenUsage?: number;
  }[]>([]);
  const [model, setModel] = useState<GeminiModel>(GeminiModel.FLASH);
  const [modelRight, setModelRight] = useState<GeminiModel>(GeminiModel.PRO);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [systemInstructionRight, setSystemInstructionRight] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [userPromptRight, setUserPromptRight] = useState('');
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [kbName, setKbName] = useState('');
  const [toolCallCount, setToolCallCount] = useState<number>(0);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.95);
  const [jsonFormatEnabled, setJsonFormatEnabled] = useState(false);
  const [referenceHistoryEnabled, setReferenceHistoryEnabled] = useState(false);
  const isCancelledRef = useRef(false);

  const [kbNameLeft, setKbNameLeft] = useState('');
  const [kbNameRight, setKbNameRight] = useState('');
  const [toolCallCountLeft, setToolCallCountLeft] = useState<number>(0);
  const [toolCallCountRight, setToolCallCountRight] = useState<number>(0);
  const [temperatureLeft, setTemperatureLeft] = useState<number>(0.7);
  const [temperatureRight, setTemperatureRight] = useState<number>(0.7);
  const [topPLeft, setTopPLeft] = useState<number>(0.95);
  const [topPRight, setTopPRight] = useState<number>(0.95);
  const [jsonFormatEnabledLeft, setJsonFormatEnabledLeft] = useState(false);
  const [jsonFormatEnabledRight, setJsonFormatEnabledRight] = useState(false);
  const [referenceHistoryEnabledLeft, setReferenceHistoryEnabledLeft] = useState(false);
  const [referenceHistoryEnabledRight, setReferenceHistoryEnabledRight] = useState(false);

  interface InputParam { id: string; name: string; type: string; source: string; description: string; }
  const [inputParams, setInputParams] = useState<InputParam[]>([{ id: 'p1', name: 'text', type: 'string', source: '引用', description: '接收文本消息/text' }]);
  const [inputParamsLeft, setInputParamsLeft] = useState<InputParam[]>([{ id: 'lp1', name: 'text', type: 'string', source: '引用', description: '接收文本消息/text' }]);
  const [inputParamsRight, setInputParamsRight] = useState<InputParam[]>([{ id: 'rp1', name: 'text', type: 'string', source: '引用', description: '接收文本消息/text' }]);

  const handleRun = async () => {
    if (!userPrompt.trim()) return;
    setIsGenerating(true);
    setResponse('');
    isCancelledRef.current = false;
    try {
      const t0 = performance.now();
      const config: any = {
        temperature,
        topP,
        responseMimeType: jsonFormatEnabled ? 'application/json' : undefined,
      };
      const stream = await generateContentStream(model, userPrompt, systemInstruction, config);
      for await (const chunk of stream) {
        if (isCancelledRef.current) break;
        const c: any = chunk;
        if (c.text) setResponse((prev) => prev + c.text);
      }
      const t1 = performance.now();
      if (activeResult) {
        setResultRows(prev => prev.map(r => r.id === activeResult.id ? {
          ...r,
          resultText: response,
          latencyMs: Math.round(t1 - t0),
          status: 'DONE'
        } : r));
      }
    } catch (error: any) {
      setResponse((prev) => prev + `\n\nError: ${error?.message || 'Unknown error'}`);
      if (activeResult) {
        setResultRows(prev => prev.map(r => r.id === activeResult.id ? {
          ...r,
          resultText: `${response}\n\nError: ${error?.message || 'Unknown error'}`,
          status: 'FAILED'
        } : r));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    isCancelledRef.current = true;
    setIsGenerating(false);
  };

  const renderParamBuilder = (params: InputParam[], setParams: React.Dispatch<React.SetStateAction<InputParam[]>>, label: string) => {
    const addParam = () => setParams((prev) => [...prev, { id: Date.now().toString(), name: '', type: 'string', source: '引用', description: '' }]);
    const updateParam = (id: string, field: keyof InputParam, value: string) => setParams((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    const removeParam = (id: string) => setParams((prev) => prev.filter((p) => p.id !== id));
    return (
      <div className="space-y-3 w-full">
        {params.map((param) => (
          <div key={param.id} className="flex gap-2 items-start group">
            <div className="w-[120px]">
              <input type="text" value={param.name} onChange={(e) => updateParam(param.id, 'name', e.target.value)} placeholder="字段名" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border" />
            </div>
            <div className="w-[100px]">
              <select value={param.type} onChange={(e) => updateParam(param.id, 'type', e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border bg-white">
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="object">object</option>
                <option value="array">array</option>
              </select>
            </div>
            <div className="w-[100px]">
              <select value={param.source} onChange={(e) => updateParam(param.id, 'source', e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border bg-white">
                <option value="引用">引用</option>
                <option value="手动">手动</option>
              </select>
            </div>
            <div className="flex-1">
              <input type="text" value={param.description} onChange={(e) => updateParam(param.id, 'description', e.target.value)} placeholder="描述" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border" />
            </div>
            <button onClick={() => removeParam(param.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100">×</button>
          </div>
        ))}
        <button onClick={addParam} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors">+ {label}</button>
      </div>
    );
  };

  const rateText = (r: number) => `${Math.round(r * 100)}%`;
  const latencyText = (ms: number) => `${ms} ms`;
  const progressWidth = (p: number) => `${Math.round(p * 100)}%`;

  if (view === 'RESULTS' && activeTask) {

    const statusBadge = (s: 'DONE' | 'PENDING' | 'FAILED') => {
      if (s === 'DONE') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-100">已完成</span>;
      if (s === 'PENDING') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-50 text-gray-700 border border-gray-200">待执行</span>;
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-100">执行失败</span>;
    };

    return (
      <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('LIST')} className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors">←</button>
          <h2 className="text-lg font-bold text-gray-900">{activeTask.name}</h2>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">调试集名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">调试用例名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">响应时长</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">消耗Token</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resultRows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {activeTask.collectionName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{r.debuggerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{activeTask.model}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {r.latencyMs ? `${r.latencyMs} ms` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {r.tokenUsage ?? '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">{statusBadge(r.status)}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button
                      onClick={() => { setActiveResult(r); setView('RESULT_DETAIL'); }}
                      className="text-gray-700 hover:text-blue-600 text-xs font-medium"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (view === 'RESULT_DETAIL' && activeTask && activeResult) {
    const currentResultText = resultRows.find(r => r.id === activeResult.id)?.resultText ?? activeResult.resultText;
    const isContrast = activeTask.type === 'DEBUG' && activeTask.debugMode === 'CONTRAST';
    const isRight = isContrast && resultRows.length > 1 && activeResult.id === resultRows[1].id;

    const currentInputParams = isRight ? inputParamsRight : inputParams;
    const setCurrentInputParams = isRight ? setInputParamsRight : setInputParams;
    const currentKbName = isRight ? kbNameRight : kbName;
    const setCurrentKbName = isRight ? setKbNameRight : setKbName;
    const currentToolCallCount = isRight ? toolCallCountRight : toolCallCount;
    const setCurrentToolCallCount = isRight ? setToolCallCountRight : setToolCallCount;
    const currentTemperature = isRight ? temperatureRight : temperature;
    const setCurrentTemperature = isRight ? setTemperatureRight : setTemperature;
    const currentTopP = isRight ? topPRight : topP;
    const setCurrentTopP = isRight ? setTopPRight : setTopP;
    const currentJsonFormatEnabled = isRight ? jsonFormatEnabledRight : jsonFormatEnabled;
    const setCurrentJsonFormatEnabled = isRight ? setJsonFormatEnabledRight : setJsonFormatEnabled;
    const currentReferenceHistoryEnabled = isRight ? referenceHistoryEnabledRight : referenceHistoryEnabled;
    const setCurrentReferenceHistoryEnabled = isRight ? setReferenceHistoryEnabledRight : setReferenceHistoryEnabled;
    const currentModel = isRight ? modelRight : model;
    const setCurrentModel = isRight ? setModelRight : setModel;
    const currentSystemInstruction = isRight ? systemInstructionRight : systemInstruction;
    const setCurrentSystemInstruction = isRight ? setSystemInstructionRight : setSystemInstruction;
    const currentUserPrompt = isRight ? userPromptRight : userPrompt;
    const setCurrentUserPrompt = isRight ? setUserPromptRight : setUserPrompt;

    return (
      <div className="flex flex-col h-full bg-white overflow-hidden relative">
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('RESULTS')} className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors">←</button>
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold text-gray-900">结果详情</h2>
              <div className="flex items-center gap-2 ml-2">
                {activeResult.tokenUsage !== undefined && (
                  <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded border border-blue-100">
                    消耗Token: {activeResult.tokenUsage}
                  </span>
                )}
                {activeResult.latencyMs !== undefined && (
                  <span className="px-2.5 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded border border-green-100">
                    响应时长: {activeResult.latencyMs} ms
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 pb-24">
             <div className="mb-8 space-y-3">
                 <label className="block text-sm font-bold text-gray-900">调试器名称</label>
                 <input
                     type="text"
                     value={activeResult.debuggerName || ''}
                     onChange={(e) => {
                        const newName = e.target.value;
                        setActiveResult({ ...activeResult, debuggerName: newName });
                     }}
                     className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
                     placeholder="请输入调试器名称"
                 />
             </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm font-bold text-gray-900">输入参数</label>
                <span className="text-xs text-gray-400">定义Prompt中的变量</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                {renderParamBuilder(currentInputParams, setCurrentInputParams, '添加输入')}
              </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-900">工具设置</label>
                <div className="space-y-3">
                  <input type="text" value={currentKbName} onChange={(e) => setCurrentKbName(e.target.value)} placeholder="知识库名称" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 whitespace-nowrap min-w-[60px]">调用次数:</span>
                    <input type="number" value={currentToolCallCount} onChange={(e) => setCurrentToolCallCount(parseInt(e.target.value) || 0)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border" />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-gray-900">生成温度 (Temperature)</label>
                    <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">{currentTemperature}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.1" value={currentTemperature} onChange={(e) => setCurrentTemperature(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-gray-900">Top P</label>
                    <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">{currentTopP}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={currentTopP} onChange={(e) => setCurrentTopP(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-6">
              <div className="flex items-center justify-between py-2">
                <label className="block text-sm font-bold text-gray-900">JSON 格式输出</label>
                <div onClick={() => setCurrentJsonFormatEnabled(!currentJsonFormatEnabled)} className={`relative w-11 h-6 transition-colors rounded-full cursor-pointer ${currentJsonFormatEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-200 transform ${currentJsonFormatEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <label className="block text-sm font-bold text-gray-900">引用历史</label>
                <div onClick={() => setCurrentReferenceHistoryEnabled(!currentReferenceHistoryEnabled)} className={`relative w-11 h-6 transition-colors rounded-full cursor-pointer ${currentReferenceHistoryEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-200 transform ${currentReferenceHistoryEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">模型选择</label>
                  <select value={currentModel} onChange={(e) => setCurrentModel(e.target.value as GeminiModel)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white">
                    <option value={GeminiModel.FLASH}>Gemini 2.5 Flash</option>
                    <option value={GeminiModel.PRO}>Gemini 3 Pro (Preview)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700">系统提示词</label>
                  <textarea className="w-full h-24 p-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm" placeholder="You are a helpful assistant..." value={currentSystemInstruction} onChange={(e) => setCurrentSystemInstruction(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700">用户提示词</label>
                  <textarea className="w-full h-24 p-3 text-base border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm" placeholder="输入具体内容来测试Prompt..." value={currentUserPrompt} onChange={(e) => setCurrentUserPrompt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-gray-900">调试结果</div>
                  </div>
                  <div className="w-full min-h-[160px] p-3 border border-gray-300 rounded-lg bg-white shadow-sm font-mono text-sm whitespace-pre-wrap text-gray-800">
                    {currentResultText ? currentResultText : <span className="text-gray-400">暂无结果</span>}
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务类型</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用集合</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行版本</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行节点</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行轮数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行通过率</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均响应时长</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行进度</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map(task => (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                    task.type === 'TEST' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                  }`}>
                    {task.type === 'TEST' ? '测试' : '调试'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{task.name}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{task.collectionName}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{task.version}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <div className="flex flex-wrap gap-1.5">
                    {task.nodes.map(n => (
                      <span key={n} className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-100">
                        {n}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{task.rounds}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{task.type === 'DEBUG' ? '-' : rateText(task.passRate)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{latencyText(task.avgLatencyMs)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-2 bg-blue-600" style={{ width: progressWidth(task.progress) }} />
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{task.createdAt}</td>
                <td className="px-6 py-4 text-sm text-right">
                  <div className="flex items-center justify-end gap-3">
                    {task.type === 'TEST' && (
                      <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">测评报告</button>
                    )}
                    <button
                      onClick={() => {
                        setActiveTask(task);
                        if (task.type === 'DEBUG' && task.debugMode === 'CONTRAST') {
                          const names = task.collectionName.split('/').map(s => s.trim());
                          setResultRows([
                            { id: 'r1', debuggerName: names[0] || '调试器A', resultText: 'OK: 输出匹配预期', latencyMs: 720, status: 'DONE', sourceMethod: '从调优中心导入', tokenUsage: 1250 },
                            { id: 'r2', debuggerName: names[1] || '调试器B', resultText: 'FAILED: 接口报错 500', latencyMs: 300, status: 'FAILED', sourceMethod: '从调优中心导入', tokenUsage: 0 },
                          ]);
                        } else if (task.type === 'DEBUG' && task.debugMode === 'SINGLE') {
                          setResultRows([
                            { id: 'r1', debuggerName: task.collectionName, resultText: 'OK: 输出匹配预期', latencyMs: 720, status: 'DONE', sourceMethod: '手动输入', tokenUsage: 850 },
                            { id: 'r2', debuggerName: task.collectionName, resultText: 'FAILED: 接口报错 500', latencyMs: 300, status: 'FAILED', sourceMethod: '手动输入', tokenUsage: 0 },
                          ]);
                        } else {
                          setResultRows([
                            { id: 'r1', debuggerName: task.collectionName, resultText: 'OK: 输出匹配预期', latencyMs: 720, status: 'DONE', sourceMethod: '从调优中心导入', tokenUsage: 1250 },
                            { id: 'r2', debuggerName: task.collectionName, resultText: 'FAILED: 接口报错 500', latencyMs: 300, status: 'FAILED', sourceMethod: '从调优中心导入', tokenUsage: 0 },
                          ]);
                        }
                        setView('RESULTS');
                      }}
                      className="text-gray-700 hover:text-blue-600 text-xs font-medium"
                    >
                      详情
                    </button>
                    <button className="text-red-600 hover:text-red-800 text-xs font-medium">删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskList;
