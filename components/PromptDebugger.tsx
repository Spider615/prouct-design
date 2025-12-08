import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Trash2, StopCircle, 
  ArrowLeft, TerminalSquare, Activity, Plus, X, Save, Search
} from 'lucide-react';
import { generateContentStream } from '../services/geminiService';
import { GeminiModel } from '../types';
import { GenerateContentResponse } from '@google/genai';

// --- Types & Mock Data ---
interface DebuggerItem {
  id: string;
  name: string;
  version: string;
  node: string;
  updatedAt: string;
}

interface InputParam {
  id: string;
  name: string;
  type: string;
  source: string;
  description: string;
}

const INITIAL_DATA: DebuggerItem[] = [
  { id: '1', name: '电商客服助手', version: 'v1.2.0', node: 'Intent-Analysis', updatedAt: '2023-10-24' },
  { id: '2', name: '文案润色专家', version: 'v0.8.5', node: 'Style-Transfer', updatedAt: '2023-10-22' },
  { id: '3', name: 'Python代码生成', version: 'v2.1.0', node: 'Code-Block', updatedAt: '2023-10-20' },
  { id: '4', name: '通用摘要提取', version: 'v1.0.1', node: 'Summarization', updatedAt: '2023-10-18' },
];

interface DebuggerConfig {
  id: string;
  name: string;
  model: GeminiModel;
  createdAt: string;
}

const PromptDebugger: React.FC = () => {
  // Navigation State
  const [view, setView] = useState<'LIST' | 'DEBUGGER_LIST' | 'DEBUG' | 'LLM_RESULTS'>('LIST');
  const [items, setItems] = useState<DebuggerItem[]>(INITIAL_DATA);
  const [activeItem, setActiveItem] = useState<DebuggerItem | null>(null);

  // Debugger Logic State
  const [model, setModel] = useState<GeminiModel>(GeminiModel.FLASH);
  const [modelRight, setModelRight] = useState<GeminiModel>(GeminiModel.PRO);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [systemInstructionRight, setSystemInstructionRight] = useState('');
  const [userPrompt, setUserPrompt] = useState('Explain quantum computing to a 5-year-old.');
  const [userPromptRight, setUserPromptRight] = useState('Explain quantum computing to a 5-year-old.');
  const [response, setResponse] = useState('');
  const [responseRight, setResponseRight] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // New Configuration States
  const [debugMode, setDebugMode] = useState<'SINGLE' | 'CONTRAST'>('SINGLE');
  const [usageMode, setUsageMode] = useState<'EDIT' | 'DEBUG'>('DEBUG');
  const [inputParams, setInputParams] = useState<InputParam[]>([]);
  const [inputParamsRight, setInputParamsRight] = useState<InputParam[]>([]);
  const [kbName, setKbName] = useState('');
  const [kbNameRight, setKbNameRight] = useState('');
  const [toolCallCount, setToolCallCount] = useState<number>(0);
  const [toolCallCountRight, setToolCallCountRight] = useState<number>(0);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [temperatureRight, setTemperatureRight] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.95);
  const [topPRight, setTopPRight] = useState<number>(0.95);
  const [referenceHistoryEnabled, setReferenceHistoryEnabled] = useState(false);
  const [referenceHistoryEnabledRight, setReferenceHistoryEnabledRight] = useState(false);
  const [jsonFormatEnabled, setJsonFormatEnabled] = useState(false);
  const [jsonFormatEnabledRight, setJsonFormatEnabledRight] = useState(false);
  const [jsonParams, setJsonParams] = useState<InputParam[]>([]);
  const [jsonParamsRight, setJsonParamsRight] = useState<InputParam[]>([]);
  const [debuggers, setDebuggers] = useState<DebuggerConfig[]>([]);
  const [editingDebuggerId, setEditingDebuggerId] = useState<string | null>(null);
  const [selectedDebuggerIds, setSelectedDebuggerIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<null | { type: 'single'; dbg: DebuggerConfig } | { type: 'execution_config' }>(null);
  const [taskName, setTaskName] = useState('');
  const [rounds, setRounds] = useState<number>(1);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createVersion, setCreateVersion] = useState('');
  const [createNode, setCreateNode] = useState('');
  const versionOptions = ['v1.0.0', 'v1.2.0', 'v2.0.0'];
  const nodeOptions = ['Intent-Analysis', 'Style-Transfer', 'Code-Block', 'Summarization'];

  const [contrastLeft, setContrastLeft] = useState<DebuggerConfig | null>(null);
  const [contrastRight, setContrastRight] = useState<DebuggerConfig | null>(null);
  const [debuggerConfigName, setDebuggerConfigName] = useState('');
  const [primaryLatencyMs, setPrimaryLatencyMs] = useState<number | null>(null);
  const [primaryTokenUsage, setPrimaryTokenUsage] = useState<number | null>(null);
  const [contrastLatencyMs, setContrastLatencyMs] = useState<number | null>(null);
  const [contrastTokenUsage, setContrastTokenUsage] = useState<number | null>(null);
  
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importType, setImportType] = useState<'llm' | 'tuning'>('llm');
  const [tuningImportStep, setTuningImportStep] = useState<'initial' | 'list'>('initial');
  const [llmPrompt, setLlmPrompt] = useState('请生成5条测试数据，每条数据包含多个参数（如 name, age, city 等）。请返回 JSON 数组，每个元素是一个对象，例如 {"name": "Alice", "age": 25, "city": "New York"}。仅返回JSON。');
  const [llmGenerating, setLlmGenerating] = useState(false);
  type LlmRow = { name: string; type: string; description: string };
  const [llmRows, setLlmRows] = useState<LlmRow[]>([
    { name: 'user_info', type: 'json', description: '{"name": "张三", "age": 28, "role": "admin"}' },
    { name: 'order_data', type: 'json', description: '{"order_id": "ORD-2023001", "amount": 99.9, "status": "paid"}' }
  ]);
  const [llmCount, setLlmCount] = useState<number>(5);
  const updateLlmRow = (index: number, field: keyof LlmRow, value: string) => {
    setLlmRows(prev => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const runLlmGeneration = async () => {
    setLlmGenerating(true);
    try {
      const config = { responseMimeType: 'application/json' } as any;
      const promptText = `${llmPrompt.trim()}\n生成数量: ${llmCount}`;
      const stream = await generateContentStream(GeminiModel.FLASH, promptText, undefined, config);
      let text = '';
      for await (const chunk of stream as any) {
        const c: any = chunk;
        if (c.text) text += c.text;
      }
      let arr: any = [];
      try { arr = JSON.parse(text); } catch { arr = text.split(/\n+/).map((s: string) => s.trim()).filter(Boolean); }
      const normalize = (input: any): LlmRow[] => {
        const rows: LlmRow[] = [];
        const pushDesc = (desc: any, name: string = 'text', type: string = 'string') => {
          const d = typeof desc === 'string' ? desc : JSON.stringify(desc);
          rows.push({ name, type, description: d });
        };
        if (Array.isArray(input)) {
          for (const item of input) {
            if (typeof item === 'string') {
              pushDesc(item);
            } else if (Array.isArray(item)) {
              for (const sub of item) pushDesc(sub);
            } else if (typeof item === 'object' && item) {
              const name = item.name ?? 'text';
              const type = item.type ?? 'string';
              if (Array.isArray(item.values)) {
                for (const v of item.values) pushDesc(v, name, type);
              } else if (item.description) {
                pushDesc(item.description, name, type);
              } else if (item.value) {
                pushDesc(item.value, name, type);
              } else {
                pushDesc(item, name, type);
              }
            } else {
              pushDesc(item);
            }
          }
        } else if (typeof input === 'string') {
          for (const line of input.split(/\n+/)) if (line.trim()) pushDesc(line.trim());
        }
        return rows;
      };
      let rows = normalize(arr);
      if (rows.length > llmCount) rows = rows.slice(0, llmCount);
      setLlmRows(rows);
    } finally {
      setLlmGenerating(false);
    }
  };
  
  const isCancelledRef = useRef(false);

  // --- Actions ---
  const handleEnterDebuggerList = (item: DebuggerItem) => {
    setActiveItem(item);
    setDebuggers([
      { id: 'd1', name: '上下文重写1', model: GeminiModel.FLASH, createdAt: '2025-11-28 10:21' },
      { id: 'd2', name: '上下文重写2', model: GeminiModel.PRO, createdAt: '2025-11-28 10:22' },
    ]);
    setView('DEBUGGER_LIST');
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this debugger?')) {
        setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  

  const handleBackToList = () => {
    setView('LIST');
    setActiveItem(null);
  };

  const handleBackToDebuggerList = () => {
    setView('DEBUGGER_LIST');
  };

  const handleRun = async (options?: { append?: boolean }) => {
    if (debugMode === 'SINGLE' && !userPrompt.trim()) return;
    if (debugMode === 'CONTRAST' && (!userPrompt.trim() && !userPromptRight.trim())) return;

    setIsGenerating(true);
    if (!options?.append) setResponse('');
    if (debugMode === 'CONTRAST' && !options?.append) setResponseRight('');
    
    isCancelledRef.current = false;
    setPrimaryLatencyMs(null);
    setPrimaryTokenUsage(null);
    setContrastLatencyMs(null);
    setContrastTokenUsage(null);

    try {
      const runPrimary = async () => {
        if (!userPrompt.trim()) return;
        const t0 = performance.now();
        const config = {
          temperature,
          topP,
          responseMimeType: jsonFormatEnabled ? 'application/json' : undefined,
        };
        const stream = await generateContentStream(model, userPrompt, systemInstruction, config);
        for await (const chunk of stream) {
          if (isCancelledRef.current) break;
          const c = chunk as GenerateContentResponse;
          if (c.text) setResponse(prev => prev + c.text);
          const anyChunk: any = c as any;
          const usage = anyChunk?.usageMetadata?.totalTokenCount;
          if (typeof usage === 'number') setPrimaryTokenUsage(usage);
        }
        const t1 = performance.now();
        setPrimaryLatencyMs(Math.round(t1 - t0));
      };

      const runContrast = async () => {
        if (debugMode !== 'CONTRAST' || !userPromptRight.trim()) return;
        const t0 = performance.now();
        const config = {
          temperature: temperatureRight,
          topP: topPRight,
          responseMimeType: jsonFormatEnabledRight ? 'application/json' : undefined,
        };
        const stream = await generateContentStream(modelRight, userPromptRight, systemInstructionRight, config);
        for await (const chunk of stream) {
          if (isCancelledRef.current) break;
          const c = chunk as GenerateContentResponse;
          if (c.text) setResponseRight(prev => prev + c.text);
          const anyChunk: any = c as any;
          const usage = anyChunk?.usageMetadata?.totalTokenCount;
          if (typeof usage === 'number') setContrastTokenUsage(usage);
        }
        const t1 = performance.now();
        setContrastLatencyMs(Math.round(t1 - t0));
      };

      await Promise.all([runPrimary(), runContrast()]);
    } catch (error) {
      setResponse(prev => prev + `\n\nError: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      if (debugMode === 'CONTRAST') {
         setResponseRight(prev => prev + `\n\nError: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    isCancelledRef.current = true;
    setIsGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modelLabel = (m: GeminiModel) => {
    if (m === GeminiModel.FLASH) return 'Gemini 2.5 Flash';
    if (m === GeminiModel.PRO) return 'Gemini 3 Pro (Preview)';
    return m;
  };

  const enterEdit = (item: DebuggerItem, m?: GeminiModel, mode?: 'SINGLE' | 'CONTRAST', usage: 'EDIT' | 'DEBUG' = 'DEBUG') => {
    setActiveItem(item);
    setSystemInstruction(`You are the ${item.name}.`);
    setSystemInstructionRight(`You are the ${item.name}.`);
    setDebugMode(mode ?? 'SINGLE');
    setUsageMode(usage);
    setInputParams([
      { id: Date.now().toString(), name: 'text', type: 'string', source: '引用', description: '接收文本消息/text' },
      { id: Date.now().toString() + '1', name: 'name', type: 'string', source: '引用', description: '小明' },
      { id: Date.now().toString() + '2', name: 'age', type: 'number', source: '引用', description: '12' }
    ]);
    setInputParamsRight([
      { id: Date.now().toString(), name: 'text', type: 'string', source: '引用', description: '接收文本消息/text' },
      { id: Date.now().toString() + '1', name: 'name', type: 'string', source: '引用', description: '小明' },
      { id: Date.now().toString() + '2', name: 'age', type: 'number', source: '引用', description: '12' }
    ]);
    setKbName('');
    setKbNameRight('');
    setToolCallCount(0);
    setToolCallCountRight(0);
    setTemperature(0.7);
    setTemperatureRight(0.7);
    setTopP(0.95);
    setTopPRight(0.95);
    setReferenceHistoryEnabled(false);
    setReferenceHistoryEnabledRight(false);
    setJsonFormatEnabled(false);
    setJsonFormatEnabledRight(false);
    setJsonParams([]);
    setJsonParamsRight([]);
    setPendingAction(null);
    if (m) setModel(m);
    if (mode === 'SINGLE') {
      setContrastLeft(null);
      setContrastRight(null);
    }
    setView('DEBUG');
  };

  const editDebugger = (dbg: DebuggerConfig) => {
    if (!activeItem) return;
    setDebuggerConfigName(dbg.name);
    enterEdit(activeItem, dbg.model, 'SINGLE', 'EDIT');
  };

  const startDebugger = (dbg: DebuggerConfig) => {
    setPendingAction({ type: 'single', dbg });
    setTaskName('');
    setRounds(1);
  };

  const toggleSelectDebugger = (id: string) => {
    setSelectedDebuggerIds(prev => (
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ));
  };

  const isAllSelected = debuggers.length > 0 && selectedDebuggerIds.length === debuggers.length;

  const toggleSelectAll = () => {
    setSelectedDebuggerIds(prev => (isAllSelected ? [] : debuggers.map(d => d.id)));
  };

  const batchDelete = () => {
    if (selectedDebuggerIds.length === 0) return;
    setDebuggers(prev => prev.filter(d => !selectedDebuggerIds.includes(d.id)));
    setSelectedDebuggerIds([]);
  };

  const compareDebuggers = () => {
    if (selectedDebuggerIds.length < 1) return;
    
    const first = debuggers.find(d => d.id === selectedDebuggerIds[0]) || null;
    const second = debuggers.find(d => d.id === selectedDebuggerIds[1]) || null;
    
    if (activeItem && first) {
      if (selectedDebuggerIds.length === 1) {
        setDebuggerConfigName(first.name);
        enterEdit(activeItem, first.model, 'SINGLE', 'DEBUG');
      } else {
        setContrastLeft(first);
        setContrastRight(second);
        enterEdit(activeItem, first.model, 'CONTRAST', 'DEBUG');
      }
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    setTaskName('');
    setRounds(1);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    if (!taskName.trim() || rounds < 1) return;
    if (!activeItem) return;
    
    if (pendingAction.type === 'single') {
      enterEdit(activeItem, pendingAction.dbg.model, 'SINGLE');
      for (let i = 0; i < rounds; i++) {
        await handleRun({ append: i > 0 });
      }
    } else if (pendingAction.type === 'execution_config') {
      // Execute contrast run
       for (let i = 0; i < rounds; i++) {
        await handleRun({ append: i > 0 });
      }
    }
    cancelAction();
  };

  const deleteDebugger = (id: string) => {
    setDebuggers(prev => prev.filter(d => d.id !== id));
  };

  const duplicateDebugger = (dbg: DebuggerConfig) => {
    setDebuggers(prev => {
      const idx = prev.findIndex(d => d.id === dbg.id);
      const newItem: DebuggerConfig = {
        id: `d${Date.now().toString()}`,
        name: `${dbg.name}-复制`,
        model: dbg.model,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      if (idx === -1) return [...prev, newItem];
      const next = [...prev];
      next.splice(idx + 1, 0, newItem);
      return next;
    });
  };

  const updateDebuggerModel = (id: string, m: GeminiModel) => {
    setDebuggers(prev => prev.map(d => (d.id === id ? { ...d, model: m } : d)));
  };

  // Helper for Input Params List
  const renderParamBuilder = (params: InputParam[], setParams: React.Dispatch<React.SetStateAction<InputParam[]>>, label: string, readOnly: boolean = false) => {
    const addParam = () => {
      setParams(prev => [...prev, { id: Date.now().toString(), name: '', type: 'string', source: '引用', description: '' }]);
    };

    const updateParam = (id: string, field: keyof InputParam, value: string) => {
      setParams(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const removeParam = (id: string) => {
      setParams(prev => prev.filter(p => p.id !== id));
    };

    return (
      <div className="space-y-3 w-full">
        {params.map((param) => (
          <div key={param.id} className="flex gap-2 items-start group">
             <div className="w-[120px]">
               <input 
                 type="text" 
                 value={param.name}
                 onChange={(e) => updateParam(param.id, 'name', e.target.value)}
                 placeholder="字段名"
                 disabled={true}
                 className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border bg-gray-100 text-gray-500 cursor-not-allowed"
               />
             </div>
             <div className="w-[100px]">
               <select
                 value={param.type}
                 onChange={(e) => updateParam(param.id, 'type', e.target.value)}
                 disabled={true}
                 className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border bg-gray-100 text-gray-500 cursor-not-allowed"
               >
                 <option value="string">string</option>
                 <option value="number">number</option>
                 <option value="boolean">boolean</option>
                 <option value="object">object</option>
                 <option value="array">array</option>
               </select>
             </div>
             <div className="flex-1">
                <input 
                 type="text" 
                 value={param.description}
                 onChange={(e) => updateParam(param.id, 'description', e.target.value)}
                 placeholder="描述"
                 disabled={readOnly}
                 className={`w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border ${
                   readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                 }`}
               />
             </div>
             {!readOnly && (
               <button 
                  onClick={() => removeParam(param.id)}
                  className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
               >
                 <X size={16} />
               </button>
             )}
          </div>
        ))}
        {/* <button 
          onClick={addParam}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors"
        >
          <Plus size={14} />
          {label}
        </button> */}
      </div>
    );
  };

  const importConfigModal = importModalVisible && (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[600px] p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-base font-bold text-gray-900">导入调试用例</div>
          <button onClick={() => setImportModalVisible(false)} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setImportType('llm')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              importType === 'llm' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            大模型生成
          </button>
          <button
            onClick={() => {
                setImportType('tuning');
                setTuningImportStep('initial');
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              importType === 'tuning' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            从调优中心导入
          </button>
        </div>

        <div className="min-h-[200px]">
          {importType === 'llm' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">生成指令</label>
                <textarea
                  value={llmPrompt}
                  onChange={(e) => setLlmPrompt(e.target.value)}
                  className="w-full h-24 p-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">生成数量</span>
                <input
                  type="number"
                  min={1}
                  value={llmCount}
                  onChange={(e) => setLlmCount(parseInt(e.target.value) || 1)}
                  className="w-24 text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-2 border"
                />
              </div>
            </div>
          ) : (
            tuningImportStep === 'initial' ? (
                 <div 
                    onClick={() => setTuningImportStep('list')}
                    className="flex items-center justify-center h-[200px] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                 >
                    <div className="flex items-center gap-2 text-blue-600 font-medium bg-blue-50 px-4 py-2 rounded-md">
                        <Plus size={18} />
                        从调优中心导入
                    </div>
                 </div>
            ) : (
                <div className="space-y-2">
                <div className="relative">
                    <input 
                    type="text" 
                    placeholder="搜索调优任务..." 
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">
                    <Search size={16} /> 
                    </div>
                </div>
                <div className="border border-gray-200 rounded-md max-h-[240px] overflow-y-auto">
                    {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center p-3 hover:bg-gray-50 border-b last:border-0 cursor-pointer">
                        <input type="radio" name="tuning-task" className="mr-3 text-blue-600 focus:ring-blue-500" />
                        <div>
                        <div className="text-sm font-medium text-gray-900">电商客服意图识别优化_v{i}.0</div>
                        <div className="text-xs text-gray-500 mt-0.5">更新时间: 2023-11-0{i} 14:30</div>
                        </div>
                        <div className="ml-auto">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            已完成
                            </span>
                        </div>
                    </div>
                    ))}
                </div>
                </div>
            )
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setImportModalVisible(false)}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={async () => {
              if (importType === 'llm') {
                setImportModalVisible(false);
                setView('LLM_RESULTS');
                await runLlmGeneration();
              } else {
                alert('导入成功');
                setImportModalVisible(false);
              }
            }}
            className="px-4 py-2 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            {importType === 'llm' ? '开始生成' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  );

  const taskConfigModal = pendingAction && (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[420px] p-5">
        <div className="text-base font-bold text-gray-900 mb-4">填写任务信息</div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">任务名称</label>
            <input
              type="text"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              placeholder="请输入任务名称"
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">执行轮数</label>
            <input
              type="number"
              min={1}
              value={rounds}
              onChange={e => setRounds(parseInt(e.target.value) || 1)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={cancelAction}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={confirmAction}
            disabled={!taskName.trim() || rounds < 1}
            className={`px-4 py-2 text-sm rounded-md text-white ${!taskName.trim() || rounds < 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );

  // --- Views ---

  if (view === 'LIST') {
    return (
      <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
        <div className="w-full">
            <div className="flex justify-between items-center mb-6 px-2">
                <h2 className="text-2xl font-bold text-gray-800">调试集列表</h2>
                <button onClick={() => setCreateModalVisible(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
                    新建调试集
                </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">调试集名称</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">版本号</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">节点</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 text-sm">
                                    暂无数据
                                </td>
                            </tr>
                        ) : items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                            <TerminalSquare size={20} />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                            <div className="text-xs text-gray-500">Updated {item.updatedAt}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                        {item.version}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <Activity size={14} className="text-gray-400" />
                                        {item.node}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end items-center gap-2">
                                        <button 
                                            onClick={() => alert('应用成功！')}
                                            className="text-gray-700 hover:text-blue-600 bg-white hover:bg-blue-50 px-3 py-1.5 rounded transition-colors text-xs font-medium border border-gray-300 hover:border-blue-300"
                                        >
                                            一键应用
                                        </button>
                                        <button 
                                            onClick={() => handleEnterDebuggerList(item)}
                                            className="text-gray-700 hover:text-blue-600 bg-white hover:bg-blue-50 px-3 py-1.5 rounded transition-colors text-xs font-medium border border-gray-300 hover:border-blue-300"
                                        >
                                            详情
                                        </button>
                                        
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="text-red-600 hover:text-red-800 bg-white hover:bg-red-50 px-3 py-1.5 rounded transition-colors text-xs font-medium border border-gray-200"
                                        >
                                            删除
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {createModalVisible && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg w-[520px] p-6">
                  <div className="text-base font-bold text-gray-900 mb-4">新增调试集</div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">调试集名称</label>
                      <input
                        type="text"
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                        placeholder="请输入调试集名称"
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">版本号</label>
                      <select
                        value={createVersion}
                        onChange={e => setCreateVersion(e.target.value)}
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white"
                      >
                        <option value="">请选择版本</option>
                        {versionOptions.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">节点</label>
                      <select
                        value={createNode}
                        onChange={e => setCreateNode(e.target.value)}
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white"
                      >
                        <option value="">请选择节点</option>
                        {nodeOptions.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setCreateModalVisible(false);
                        setCreateName('');
                        setCreateVersion('');
                        setCreateNode('');
                      }}
                      className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        if (!createName.trim() || !createVersion || !createNode) return;
                        const newItem = {
                          id: Date.now().toString(),
                          name: createName.trim(),
                          version: createVersion,
                          node: createNode,
                          updatedAt: new Date().toISOString().slice(0, 10),
                        } as DebuggerItem;
                        setItems(prev => [newItem, ...prev]);
                        setCreateModalVisible(false);
                        setCreateName('');
                        setCreateVersion('');
                        setCreateNode('');
                      }}
                      disabled={!createName.trim() || !createVersion || !createNode}
                      className={`px-4 py-2 text-sm rounded-md text-white ${!createName.trim() || !createVersion || !createNode ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      确定
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    );
  }

  if (view === 'DEBUGGER_LIST') {
    return (
      <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBackToList}
            className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{activeItem?.name}</h2>
          <span className="text-xs text-gray-400">• {activeItem?.node}</span>
          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() => setImportModalVisible(true)}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors"
            >
              导入调试用例
            </button>
            <button
              onClick={() => {
                if (activeItem) {
                    setDebuggerConfigName('');
                    enterEdit(activeItem, GeminiModel.FLASH, 'SINGLE', 'EDIT');
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors"
            >
              新建调试用例
            </button>
            <button
              onClick={compareDebuggers}
              disabled={selectedDebuggerIds.length < 1}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                selectedDebuggerIds.length >= 1
                  ? 'border-purple-600 text-purple-600 hover:bg-purple-50 bg-white'
                  : 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
              }`}
            >
              调试台
            </button>
            <button
              onClick={batchDelete}
              disabled={selectedDebuggerIds.length === 0}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                selectedDebuggerIds.length > 0
                  ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 bg-white'
                  : 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
              }`}
            >
              删除
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">调试用例名称</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">模型</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">创建时间</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {debuggers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">暂无调试器</td>
                </tr>
              ) : (
                debuggers.map(dbg => (
                  <tr key={dbg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedDebuggerIds.includes(dbg.id)}
                        onChange={() => toggleSelectDebugger(dbg.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{dbg.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{modelLabel(dbg.model)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{dbg.createdAt}</td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => editDebugger(dbg)}
                          className="text-gray-700 hover:text-blue-600 bg-white hover:bg-blue-50 px-3 py-1.5 rounded border border-gray-300 text-xs font-medium"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => duplicateDebugger(dbg)}
                          className="text-gray-700 hover:text-blue-600 bg-white hover:bg-blue-50 px-3 py-1.5 rounded border border-gray-300 text-xs font-medium flex items-center gap-1"
                        >
                          复制
                        </button>
                        <button
                          onClick={() => startDebugger(dbg)}
                          className="text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-xs font-medium"
                        >
                          创建任务
                        </button>
                        <button
                          onClick={() => deleteDebugger(dbg.id)}
                          className="text-red-600 hover:text-red-800 bg-white hover:bg-red-50 px-3 py-1.5 rounded border border-gray-200 text-xs font-medium"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {taskConfigModal}
        {importConfigModal}
      </div>
    );
  }

  if (view === 'LLM_RESULTS') {
    return (
      <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">生成结果</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={runLlmGeneration}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${llmGenerating ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              刷新
            </button>
            <button
              onClick={() => {
                const params = llmRows.map((r, i) => ({
                  id: `llm-${Date.now()}-${i}`,
                  name: r.name || 'text',
                  type: r.type || 'string',
                  source: '手动',
                  description: r.description || ''
                }));
                setInputParams(params);
                alert('导入成功！');
              }}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              导入用例
            </button>
            <button
              onClick={() => {
                const ok = confirm('生成过程中取消后数据不会保存，请确认是否取消');
                if (ok) {
                  setView('DEBUGGER_LIST');
                }
              }}
              className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">输入参数</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {llmRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-sm text-gray-500">暂无数据</td>
                </tr>
              ) : (
                (() => {
                  const allKeys = new Set<string>();
                  const keyTypes = new Map<string, string>();
                  
                  llmRows.forEach(r => {
                    try {
                      const p = JSON.parse(r.description);
                      if (p && typeof p === 'object' && !Array.isArray(p)) {
                        Object.keys(p).forEach(k => {
                          allKeys.add(k);
                          if (!keyTypes.has(k) && p[k] !== undefined && p[k] !== null) {
                             let t: string = typeof p[k];
                             if (Array.isArray(p[k])) t = 'array';
                             keyTypes.set(k, t);
                          }
                        });
                      }
                    } catch {}
                  });
                  const unifiedKeys = Array.from(allKeys);
                  const hasStructuredData = unifiedKeys.length > 0;

                  return llmRows.map((row, i) => {
                    let parsed: any = {};
                    try {
                      parsed = JSON.parse(row.description);
                    } catch {}
                    
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                       parsed = {}; 
                    }

                    return (
                      <tr key={i}>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          <div className="flex items-start gap-2">
                            <span className="w-7 text-xs text-gray-500 text-center mt-2">{i + 1}</span>
                            {hasStructuredData ? (
                              <div className="flex-1 border border-gray-200 rounded-md p-2 bg-gray-50 space-y-2">
                                {unifiedKeys.map((key) => {
                                  const type = keyTypes.get(key) || 'string';
                                  return (
                                    <div key={key} className="flex items-center gap-2">
                                      <div className="w-24 text-right text-xs text-gray-500 truncate" title={key}>{key}</div>
                                      <div className="w-[100px]">
                                        <select
                                          value={type}
                                          disabled={true}
                                          className="w-full text-sm border-gray-300 rounded-md shadow-sm py-1 px-2 border bg-gray-100 text-gray-500 cursor-not-allowed"
                                        >
                                          <option value="string">string</option>
                                          <option value="number">number</option>
                                          <option value="boolean">boolean</option>
                                          <option value="object">object</option>
                                          <option value="array">array</option>
                                        </select>
                                      </div>
                                      <input
                                        type="text"
                                        value={parsed[key] !== undefined ? (typeof parsed[key] === 'string' ? parsed[key] : JSON.stringify(parsed[key])) : ''}
                                        onChange={(e) => {
                                          const newVal = e.target.value;
                                          const newObj = { ...parsed, [key]: newVal };
                                          updateLlmRow(i, 'description', JSON.stringify(newObj));
                                        }}
                                        className="flex-1 text-sm border-gray-300 rounded-md shadow-sm py-1 px-2 border"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) => updateLlmRow(i, 'description', e.target.value)}
                                className="flex-1 text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-2 border"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Debug View
  const renderDebugPanel = (mode: 'PRIMARY' | 'CONTRAST') => {
    const currentModel = mode === 'PRIMARY' ? model : modelRight;
    const setCurrentModel = mode === 'PRIMARY' ? setModel : setModelRight;
    const isPrimary = mode === 'PRIMARY';

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 space-y-4">
          {/* Input Params */}
          <div className="space-y-2">
             <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-900">输入参数</label>
                <span className="text-xs text-gray-400 font-normal">定义Prompt中的变量</span>
             </div>
             <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                 {renderParamBuilder(
                   isPrimary ? inputParams : inputParamsRight,
                   isPrimary ? setInputParams : setInputParamsRight,
                   '添加输入',
                   true
                 )}
             </div>
          </div>

          {/* Tools & Model Config */}
          <div className="grid grid-cols-2 gap-4">
              {/* Tools */}
              <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-900">工具设置</label>
                  <div className="space-y-3">
                      <input
                        type="text"
                        value={isPrimary ? kbName : kbNameRight}
                        onChange={(e) => isPrimary ? setKbName(e.target.value) : setKbNameRight(e.target.value)}
                        placeholder="知识库名称"
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 whitespace-nowrap">调用次数:</span>
                        <input
                          type="number"
                          value={isPrimary ? toolCallCount : toolCallCountRight}
                          onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              isPrimary ? setToolCallCount(val) : setToolCallCountRight(val);
                          }}
                          className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1 px-2 border"
                        />
                      </div>
                  </div>
              </div>

              {/* Params */}
              <div className="space-y-3">
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="block text-xs font-bold text-gray-900">Temperature</label>
                          <span className="text-xs text-blue-600 font-medium bg-blue-50 px-1.5 rounded">{isPrimary ? temperature : temperatureRight}</span>
                      </div>
                      <input
                          type="range" min="0" max="1" step="0.1"
                          value={isPrimary ? temperature : temperatureRight}
                          onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              isPrimary ? setTemperature(val) : setTemperatureRight(val);
                          }}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                  </div>
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="block text-xs font-bold text-gray-900">Top P</label>
                          <span className="text-xs text-blue-600 font-medium bg-blue-50 px-1.5 rounded">{isPrimary ? topP : topPRight}</span>
                      </div>
                      <input
                          type="range" min="0" max="1" step="0.05"
                          value={isPrimary ? topP : topPRight}
                          onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              isPrimary ? setTopP(val) : setTopPRight(val);
                          }}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                  </div>
              </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-gray-900">JSON输出</label>
                  <div
                      onClick={() => isPrimary ? setJsonFormatEnabled(!jsonFormatEnabled) : setJsonFormatEnabledRight(!jsonFormatEnabledRight)}
                      className={`relative w-9 h-5 transition-colors rounded-full cursor-pointer ${
                          (isPrimary ? jsonFormatEnabled : jsonFormatEnabledRight) ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                  >
                      <span className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 transform ${
                          (isPrimary ? jsonFormatEnabled : jsonFormatEnabledRight) ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                  </div>
              </div>
              <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-gray-900">引用历史</label>
                  <div
                      onClick={() => isPrimary ? setReferenceHistoryEnabled(!referenceHistoryEnabled) : setReferenceHistoryEnabledRight(!referenceHistoryEnabledRight)}
                      className={`relative w-9 h-5 transition-colors rounded-full cursor-pointer ${
                          (isPrimary ? referenceHistoryEnabled : referenceHistoryEnabledRight) ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                  >
                      <span className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 transform ${
                          (isPrimary ? referenceHistoryEnabled : referenceHistoryEnabledRight) ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                  </div>
              </div>
          </div>
          {(isPrimary ? jsonFormatEnabled : jsonFormatEnabledRight) && (
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mt-2">
                <h4 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Schema Definition</h4>
                {renderParamBuilder(
                    isPrimary ? jsonParams : jsonParamsRight,
                    isPrimary ? setJsonParams : setJsonParamsRight,
                    '添加Schema字段',
                    true
                )}
            </div>
          )}

          {/* Model Selection (Inside Panel - Only for CONTRAST mode) */}
          <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">模型选择</label>
              <select
                  value={currentModel}
                  onChange={(e) => setCurrentModel(e.target.value as GeminiModel)}
                  className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white"
              >
                  <option value={GeminiModel.FLASH}>Gemini 2.5 Flash</option>
                  <option value={GeminiModel.PRO}>Gemini 3 Pro (Preview)</option>
              </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">系统提示词</label>
            </div>
            <textarea
              className="w-full h-24 p-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm leading-relaxed"
              placeholder="You are a helpful assistant..."
              value={isPrimary ? systemInstruction : systemInstructionRight}
              onChange={(e) => isPrimary ? setSystemInstruction(e.target.value) : setSystemInstructionRight(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">用户提示词</label>
            <textarea
              className="w-full h-24 p-3 text-base border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm leading-relaxed"
              placeholder="输入具体内容来测试Prompt..."
              value={isPrimary ? userPrompt : userPromptRight}
              onChange={(e) => isPrimary ? setUserPrompt(e.target.value) : setUserPromptRight(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">调试结果</label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">
                  消耗Token: {mode === 'PRIMARY' ? (primaryTokenUsage ?? 0) : (contrastTokenUsage ?? 0)}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded bg-green-50 text-green-700 border border-green-100">
                  响应时长: {mode === 'PRIMARY' ? (primaryLatencyMs ?? 0) : (contrastLatencyMs ?? 0)} ms
                </span>
              </div>
            </div>
            <div className="w-full min-h-[160px] p-3 border border-gray-300 rounded-lg bg-white shadow-sm font-mono text-sm whitespace-pre-wrap text-gray-800">
              {isGenerating ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    Generating...
                  </div>
              ) : (
                (isPrimary ? response : responseRight) || <span className="text-gray-400">暂无结果...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden relative">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBackToDebuggerList}
                    className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                <h2 className="text-lg font-bold text-gray-900">
                    {usageMode === 'DEBUG' ? '调试台' : activeItem?.name}
                </h2>

                <div className="h-4 w-px bg-gray-300 mx-1"></div>

                {/* Debug Mode Badge/Toggle */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer flex items-center gap-1 transition-colors ${
                    debugMode === 'SINGLE'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                  onClick={() => setDebugMode(debugMode === 'SINGLE' ? 'CONTRAST' : 'SINGLE')}
                  title="Click to switch mode"
                >
                   {debugMode === 'SINGLE' ? '单点调试' : '对比调试'}
                </div>

                <span className="text-xs text-gray-400 flex items-center">
                   • {activeItem?.node}
                </span>
            </div>
        </div>

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-24">

            {/* Debugger Name - Only show in SINGLE mode */}
            {debugMode === 'SINGLE' && (usageMode === 'EDIT' || usageMode === 'DEBUG') && (
                <div className="mb-8 space-y-3">
                    <label className="block text-sm font-bold text-gray-900">调试用例名称</label>
                    {usageMode === 'EDIT' ? (
                        <input
                            type="text"
                            value={debuggerConfigName}
                            onChange={(e) => setDebuggerConfigName(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
                            placeholder="请输入调试用例名称"
                        />
                    ) : (
                        <div className="text-sm text-gray-900 py-2">
                            {debuggerConfigName}
                        </div>
                    )}
                </div>
            )}

            {/* 1. Input Parameters - Show in EDIT mode */}
            {debugMode === 'SINGLE' && usageMode === 'EDIT' && (
              <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                      <label className="text-sm font-bold text-gray-900">输入参数</label>
                      <span className="text-xs text-gray-400 font-normal">定义Prompt中的变量</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                      {renderParamBuilder(inputParams, setInputParams, '添加输入')}
                  </div>
              </div>
            )}

            {/* 2. Configuration Grid - Show in DEBUG mode (previously hidden in SINGLE) */}
            {/* Re-enabled for usageMode === 'DEBUG' */}
            {debugMode === 'SINGLE' && usageMode === 'DEBUG' && (
              <div className="grid grid-cols-2 gap-x-12 gap-y-8 mb-8">
                  {/* Left Column */}
                  <div className="space-y-8">
                      {/* Tools */}
                      <div className="space-y-3">
                          <label className="block text-sm font-bold text-gray-900">工具设置</label>
                          <div className="space-y-3">
                              <input 
                                type="text" 
                                value={kbName} 
                                onChange={(e) => setKbName(e.target.value)} 
                                placeholder="知识库名称" 
                                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" 
                              />
                              <div className="flex items-center gap-3">
                                  <span className="text-sm text-gray-500 whitespace-nowrap min-w-[60px]">调用次数:</span>
                                  <input 
                                    type="number" 
                                    value={toolCallCount} 
                                    onChange={(e) => setToolCallCount(parseInt(e.target.value) || 0)} 
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border" 
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Params */}
                      <div className="space-y-6">
                          <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                  <label className="block text-sm font-bold text-gray-900">生成温度 (Temperature)</label>
                                  <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">{temperature}</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" max="1" step="0.1" 
                                value={temperature} 
                                onChange={(e) => setTemperature(parseFloat(e.target.value))} 
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                              />
                          </div>
                          <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                  <label className="block text-sm font-bold text-gray-900">Top P</label>
                                  <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">{topP}</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" max="1" step="0.05" 
                                value={topP} 
                                onChange={(e) => setTopP(parseFloat(e.target.value))} 
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                              />
                          </div>
                      </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-8">
                      {/* Model Selection */}
                      <div className="space-y-3">
                          <label className="block text-sm font-bold text-gray-900">模型选择</label>
                          <select 
                            value={model} 
                            onChange={(e) => setModel(e.target.value as GeminiModel)} 
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white"
                          >
                              <option value={GeminiModel.FLASH}>Gemini 2.5 Flash</option>
                              <option value={GeminiModel.PRO}>Gemini 3 Pro (Preview)</option>
                          </select>
                      </div>

                      {/* System Instruction */}
                      <div className="space-y-3">
                          <label className="text-sm font-bold text-gray-900">系统提示词</label>
                          <textarea 
                            className="w-full h-32 p-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm" 
                            placeholder="You are a helpful assistant..." 
                            value={systemInstruction} 
                            onChange={(e) => setSystemInstruction(e.target.value)} 
                          />
                      </div>
                  </div>
              </div>
            )}

            {/* 3. JSON Output Switch - Show in DEBUG mode */}
            {debugMode === 'SINGLE' && usageMode === 'DEBUG' && (
              <div className="mb-8 grid grid-cols-2 gap-6">
                  <div className="flex items-center justify-between py-2">
                      <label className="block text-sm font-bold text-gray-900">JSON 格式输出</label>
                      <div 
                        onClick={() => setJsonFormatEnabled(!jsonFormatEnabled)} 
                        className={`relative w-11 h-6 transition-colors rounded-full cursor-pointer ${jsonFormatEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                          <span className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-200 transform ${jsonFormatEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                      <label className="block text-sm font-bold text-gray-900">引用历史</label>
                      <div 
                        onClick={() => setReferenceHistoryEnabled(!referenceHistoryEnabled)} 
                        className={`relative w-11 h-6 transition-colors rounded-full cursor-pointer ${referenceHistoryEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                          <span className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-200 transform ${referenceHistoryEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                  </div>
              </div>
            )}
            
            {debugMode === 'SINGLE' && usageMode === 'DEBUG' && jsonFormatEnabled && (
                <div className="mb-8 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <h4 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Schema Definition</h4>
                    {renderParamBuilder(jsonParams, setJsonParams, '添加Schema字段')}
                </div>
            )}

            {/* 4. Unified Debug Block */}
            <div className="space-y-4">
                {debugMode === 'SINGLE' && usageMode === 'DEBUG' && (
                    /* User Prompt & Output for Single Debug Mode */
                    <div className="space-y-6">
                         {/* Input Parameters (Values) - If any */}
                         {inputParams.length > 0 && (
                             <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">输入变量</h4>
                                 <div className="space-y-3">
                                     {inputParams.map(param => (
                                         <div key={param.id} className="flex flex-col gap-1">
                                             <label className="text-xs font-medium text-gray-700">{param.name} ({param.type})</label>
                                             <input type="text" placeholder={`Enter value for ${param.name}`} className="w-full text-sm border-gray-300 rounded-md py-1.5 px-3 border focus:ring-blue-500 focus:border-blue-500" />
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         )}

                         <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-900">用户提示词</label>
                            <textarea 
                                className="w-full h-32 p-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm"
                                placeholder="Enter your prompt here..."
                                value={userPrompt}
                                onChange={(e) => setUserPrompt(e.target.value)}
                            />
                         </div>

                         {response && (
                             <div className="space-y-2">
                                 <div className="flex justify-between items-center">
                                     <label className="text-sm font-bold text-gray-900">输出结果</label>
                                     <div className="flex gap-2">
                                         <button onClick={handleCopy} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                             {copied ? 'Copied!' : 'Copy'}
                                         </button>
                                     </div>
                                 </div>
                                 <div className="w-full min-h-[100px] p-4 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm whitespace-pre-wrap">
                                     {response}
                                 </div>
                             </div>
                         )}
                    </div>
                )}
                {debugMode === 'CONTRAST' && (
                  <div className="grid grid-cols-2 gap-6 mb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{contrastLeft?.name ?? '—'}</span>
                      <button
                        onClick={() => alert('保存成功！')}
                        className="text-blue-600 bg-white hover:bg-blue-50 border border-blue-600 px-3 py-1.5 rounded-md font-medium flex items-center gap-2 shadow-sm transition-all text-xs"
                      >
                        <Save size={14} />
                        保存
                      </button>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{contrastRight?.name ?? '—'}</span>
                      <button
                        onClick={() => alert('保存成功！')}
                        className="text-blue-600 bg-white hover:bg-blue-50 border border-blue-600 px-3 py-1.5 rounded-md font-medium flex items-center gap-2 shadow-sm transition-all text-xs"
                      >
                        <Save size={14} />
                        保存
                      </button>
                    </div>
                  </div>
                )}
                {debugMode === 'CONTRAST' && (
                  <div className="grid grid-cols-2 gap-6">
                    {renderDebugPanel('PRIMARY')}
                    {renderDebugPanel('CONTRAST')}
                  </div>
                )}
            </div>
        </div>

        {/* Fixed Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-between items-center z-10">
            {usageMode === 'DEBUG' ? (
            <button
                onClick={() => {
                setUserPrompt('');
                setResponse('');
                if (debugMode === 'CONTRAST') {
                    setUserPromptRight('');
                    setResponseRight('');
                }
                }}
                className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1.5 text-sm px-3 py-2 rounded-md hover:bg-gray-200 font-medium"
            >
                <Trash2 size={16} />
                Clear Input
            </button>
            ) : <div />}

            <div className="flex items-center gap-3">
                <button
                    onClick={handleBackToDebuggerList}
                    className="text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                >
                    取消
                </button>
                {(usageMode === 'EDIT' || (usageMode === 'DEBUG' && debugMode === 'SINGLE')) && (
                    <button
                        onClick={() => alert('保存成功！')}
                        className="text-blue-600 bg-white hover:bg-blue-50 border border-blue-600 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-all text-sm"
                    >
                        <Save size={16} />
                        保存
                    </button>
                )}
                {usageMode === 'DEBUG' && (isGenerating ? (
                    <button
                    onClick={handleStop}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-all text-sm"
                    >
                    <StopCircle size={16} />
                    Stop Generation
                    </button>
                ) : (
                    <button
                    onClick={handleRun}
                    disabled={!userPrompt.trim() && (debugMode === 'SINGLE' || !userPromptRight.trim())}
                    className={`px-6 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-all transform active:scale-95 text-sm ${
                        (!userPrompt.trim() && (debugMode === 'SINGLE' || !userPromptRight.trim()))
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-200'
                    }`}
                    >
                    <Play size={16} fill="currentColor" />
                    调试
                    </button>
                ))}
            </div>
        </div>
        {taskConfigModal}
    </div>
  );
};

export default PromptDebugger;
