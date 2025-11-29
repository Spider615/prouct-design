import React, { useState, useRef } from 'react';
import { 
  Play, Sparkles, Trash2, StopCircle, Settings2, Copy, Check, 
  ArrowLeft, TerminalSquare, Activity, Plus, X, ChevronRight, ChevronDown, Save
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
}

const PromptDebugger: React.FC = () => {
  // Navigation State
  const [view, setView] = useState<'LIST' | 'DEBUGGER_LIST' | 'DEBUG'>('LIST');
  const [items, setItems] = useState<DebuggerItem[]>(INITIAL_DATA);
  const [activeItem, setActiveItem] = useState<DebuggerItem | null>(null);

  // Debugger Logic State
  const [model, setModel] = useState<GeminiModel>(GeminiModel.FLASH);
  const [modelRight, setModelRight] = useState<GeminiModel>(GeminiModel.PRO);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [userPrompt, setUserPrompt] = useState('Explain quantum computing to a 5-year-old.');
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // New Configuration States
  const [debugMode, setDebugMode] = useState<'SINGLE' | 'CONTRAST'>('SINGLE');
  const [addMethod, setAddMethod] = useState<'MANUAL' | 'IMPORT'>('MANUAL');
  const [inputParams, setInputParams] = useState<InputParam[]>([]);
  const [kbName, setKbName] = useState('');
  const [toolCallCount, setToolCallCount] = useState<number>(0);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.95);
  const [jsonFormatEnabled, setJsonFormatEnabled] = useState(false);
  const [jsonParams, setJsonParams] = useState<InputParam[]>([]);
  const [debuggers, setDebuggers] = useState<DebuggerConfig[]>([]);
  const [editingDebuggerId, setEditingDebuggerId] = useState<string | null>(null);
  const [selectedDebuggerIds, setSelectedDebuggerIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<null | { type: 'single'; dbg: DebuggerConfig } | { type: 'compare' }>(null);
  const [taskName, setTaskName] = useState('');
  const [rounds, setRounds] = useState<number>(1);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createSource, setCreateSource] = useState<'MANUAL' | 'IMPORT'>('MANUAL');
  const [createName, setCreateName] = useState('');
  const [createVersion, setCreateVersion] = useState('');
  const [createNode, setCreateNode] = useState('');
  const versionOptions = ['v1.0.0', 'v1.2.0', 'v2.0.0'];
  const nodeOptions = ['Intent-Analysis', 'Style-Transfer', 'Code-Block', 'Summarization'];

  const [contrastLeft, setContrastLeft] = useState<DebuggerConfig | null>(null);
  const [contrastRight, setContrastRight] = useState<DebuggerConfig | null>(null);
  
  const isCancelledRef = useRef(false);

  // --- Actions ---
  const handleEnterDebuggerList = (item: DebuggerItem) => {
    setActiveItem(item);
    setDebuggers([
      { id: 'd1', name: '默认调试器A', model: GeminiModel.FLASH },
      { id: 'd2', name: '高阶调试器B', model: GeminiModel.PRO },
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
    if (!userPrompt.trim()) return;

    setIsGenerating(true);
    if (!options?.append) setResponse('');
    isCancelledRef.current = false;

    try {
      const config = {
        temperature,
        topP,
        responseMimeType: jsonFormatEnabled ? 'application/json' : undefined,
      };

      const stream = await generateContentStream(model, userPrompt, systemInstruction, config);
      
      for await (const chunk of stream) {
        if (isCancelledRef.current) break;
        const c = chunk as GenerateContentResponse;
        if (c.text) {
           setResponse(prev => prev + c.text);
        }
      }
    } catch (error) {
      setResponse(prev => prev + `\n\nError: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
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

  const enterEdit = (item: DebuggerItem, m?: GeminiModel, mode?: 'SINGLE' | 'CONTRAST') => {
    setActiveItem(item);
    setSystemInstruction(`You are the ${item.name}.`);
    setDebugMode(mode ?? 'SINGLE');
    setAddMethod('MANUAL');
    setInputParams([{ id: Date.now().toString(), name: 'text', type: 'string', source: '引用', description: '接收文本消息/text' }]);
    setKbName('');
    setToolCallCount(0);
    setTemperature(0.7);
    setTopP(0.95);
    setJsonFormatEnabled(false);
    setJsonParams([]);
    if (m) setModel(m);
    if (mode === 'SINGLE') {
      setContrastLeft(null);
      setContrastRight(null);
    }
    setView('DEBUG');
  };

  const editDebugger = (dbg: DebuggerConfig) => {
    if (!activeItem) return;
    enterEdit(activeItem, dbg.model, 'SINGLE');
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
    if (selectedDebuggerIds.length < 2) return;
    setPendingAction({ type: 'compare' });
    setTaskName('');
    setRounds(1);
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
    } else {
      const first = debuggers.find(d => d.id === selectedDebuggerIds[0]) || null;
      const second = debuggers.find(d => d.id === selectedDebuggerIds[1]) || null;
      setContrastLeft(first);
      setContrastRight(second);
      enterEdit(activeItem, first ? first.model : undefined, 'CONTRAST');
      for (let i = 0; i < rounds; i++) {
        await handleRun({ append: i > 0 });
      }
    }
    cancelAction();
  };

  const deleteDebugger = (id: string) => {
    setDebuggers(prev => prev.filter(d => d.id !== id));
  };

  const updateDebuggerModel = (id: string, m: GeminiModel) => {
    setDebuggers(prev => prev.map(d => (d.id === id ? { ...d, model: m } : d)));
  };

  // Helper for Input Params List
  const renderParamBuilder = (params: InputParam[], setParams: React.Dispatch<React.SetStateAction<InputParam[]>>, label: string) => {
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
                 className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border"
               />
             </div>
             <div className="w-[100px]">
               <select
                 value={param.type}
                 onChange={(e) => updateParam(param.id, 'type', e.target.value)}
                 className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border bg-white"
               >
                 <option value="string">string</option>
                 <option value="number">number</option>
                 <option value="boolean">boolean</option>
                 <option value="object">object</option>
                 <option value="array">array</option>
               </select>
             </div>
             <div className="w-[100px]">
               <select
                 value={param.source}
                 onChange={(e) => updateParam(param.id, 'source', e.target.value)}
                 className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border bg-white"
               >
                 <option value="引用">引用</option>
                 <option value="手动">手动</option>
               </select>
             </div>
             <div className="flex-1">
                <input 
                 type="text" 
                 value={param.description}
                 onChange={(e) => updateParam(param.id, 'description', e.target.value)}
                 placeholder="描述"
                 className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 border"
               />
             </div>
             <button 
                onClick={() => removeParam(param.id)}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
             >
               <X size={16} />
             </button>
          </div>
        ))}
        <button 
          onClick={addParam}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors"
        >
          <Plus size={14} />
          {label}
        </button>
      </div>
    );
  };

  // --- Views ---

  if (view === 'LIST') {
    return (
      <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
        <div className="w-full">
            <div className="flex justify-between items-center mb-6 px-2">
                <h2 className="text-2xl font-bold text-gray-800">调试用例列表</h2>
                <button onClick={() => setCreateModalVisible(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
                    新建调试用例
                </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[30%]">调试器名称</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">版本号</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">节点</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[35%]">操作</th>
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
                  <div className="text-base font-bold text-gray-900 mb-4">新建调试用例</div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCreateSource('MANUAL')}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border ${createSource === 'MANUAL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                          手动输入
                        </button>
                        <button
                          onClick={() => setCreateSource('IMPORT')}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border ${createSource === 'IMPORT' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                          从调优中心导入
                        </button>
                      </div>
                      {createSource === 'IMPORT' && (
                        <div className="mt-3 border border-gray-200 rounded-md p-8 bg-gray-50">
                          <div className="w-full flex items-center justify-center">
                            <button className="px-4 py-2 rounded-md border border-blue-300 text-blue-600 bg-white hover:bg-blue-50 text-sm font-medium">
                              从调优中心导入
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">用例名称</label>
                      <input
                        type="text"
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                        placeholder="请输入用例名称"
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
                        setCreateSource('MANUAL');
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
                        setCreateSource('MANUAL');
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
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">{activeItem?.version}</span>
          <span className="text-xs text-gray-400">• {activeItem?.node}</span>
          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={compareDebuggers}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              对比调试
            </button>
            <button
              onClick={batchDelete}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">调试器名称</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">模型</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {debuggers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">暂无调试器</td>
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
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => editDebugger(dbg)}
                          className="text-gray-700 hover:text-blue-600 bg-white hover:bg-blue-50 px-3 py-1.5 rounded border border-gray-300 text-xs font-medium"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => startDebugger(dbg)}
                          className="text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-xs font-medium"
                        >
                          开始执行
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

        {pendingAction && (
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
        )}
      </div>
    );
  }

  // Debug View
  const renderDebugPanel = (mode: 'PRIMARY' | 'CONTRAST') => {
    const currentModel = mode === 'PRIMARY' ? model : modelRight;
    const setCurrentModel = mode === 'PRIMARY' ? setModel : setModelRight;

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 space-y-4">
          {/* Model Selection (Inside Panel - Only for CONTRAST mode) */}
          {debugMode === 'CONTRAST' && (
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
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">系统提示词</label>
            </div>
            <textarea
              className="w-full h-24 p-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm leading-relaxed"
              placeholder="You are a helpful assistant..."
              value={mode === 'PRIMARY' ? systemInstruction : ''}
              onChange={(e) => mode === 'PRIMARY' && setSystemInstruction(e.target.value)}
              readOnly={mode === 'CONTRAST'}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">用户提示词</label>
            <textarea
              className="w-full h-24 p-3 text-base border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-white shadow-sm leading-relaxed"
              placeholder="输入具体内容来测试Prompt..."
              value={mode === 'PRIMARY' ? userPrompt : ''}
              onChange={(e) => mode === 'PRIMARY' && setUserPrompt(e.target.value)}
              readOnly={mode === 'CONTRAST'}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">调试结果</label>
            </div>
            <div className="w-full min-h-[160px] p-3 border border-gray-300 rounded-lg bg-white shadow-sm font-mono text-sm whitespace-pre-wrap text-gray-800">
              {mode === 'PRIMARY' ? (
                isGenerating ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    Generating...
                  </div>
                ) : response ? (
                  response
                ) : (
                  <span className="text-gray-400">输入该用例的标准答案...</span>
                )
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  对比输出将显示在此
                </div>
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

                <h2 className="text-lg font-bold text-gray-900">{activeItem?.name}</h2>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    {activeItem?.version}
                </span>

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
            {debugMode === 'SINGLE' && (
                <div className="mb-8 space-y-3">
                    <label className="block text-sm font-bold text-gray-900">调试器名称</label>
                    <input
                        type="text"
                        value={activeItem?.name || ''}
                        onChange={(e) => {
                            if (activeItem) {
                                const newName = e.target.value;
                                setActiveItem({ ...activeItem, name: newName });
                                setItems(prev => prev.map(item => item.id === activeItem.id ? { ...item, name: newName } : item));
                            }
                        }}
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
                        placeholder="请输入调试器名称"
                    />
                </div>
            )}

            {/* 1. Input Parameters */}
            <div className="mb-8">
                 <div className="flex items-center gap-2 mb-3">
                    <label className="text-sm font-bold text-gray-900">输入参数</label>
                    <span className="text-xs text-gray-400 font-normal">定义Prompt中的变量</span>
                 </div>
                 <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                     {renderParamBuilder(inputParams, setInputParams, '添加输入')}
                 </div>
            </div>

            {/* 2. Configuration Grid */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-8 mb-8">
                 {/* Model Selection - Only for SINGLE mode */}
                 {debugMode === 'SINGLE' && (
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
                 )}
                 {/* Tools Settings */}
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

                 {/* Temperature */}
                 <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-bold text-gray-900">生成温度 (Temperature)</label>
                        <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">{temperature}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                 </div>

                 {/* Top P */}
                 <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-bold text-gray-900">Top P</label>
                        <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">{topP}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={topP}
                        onChange={(e) => setTopP(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                 </div>
            </div>

            {/* 3. JSON Output Switch */}
            <div className="mb-8 flex items-center justify-between py-2">
                <label className="block text-sm font-bold text-gray-900">JSON 格式输出</label>
                <div
                    onClick={() => setJsonFormatEnabled(!jsonFormatEnabled)}
                    className={`relative w-11 h-6 transition-colors rounded-full cursor-pointer ${jsonFormatEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                    <span className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-200 transform ${jsonFormatEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
            </div>
            {jsonFormatEnabled && (
                <div className="mb-8 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <h4 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Schema Definition</h4>
                    {renderParamBuilder(jsonParams, setJsonParams, '添加Schema字段')}
                </div>
            )}

            {/* 4. Unified Debug Block */}
            <div className="space-y-4">
                {debugMode === 'CONTRAST' && (
                  <div className="grid grid-cols-2 gap-6 mb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-900">{contrastLeft?.name ?? '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-900">{contrastRight?.name ?? '—'}</span>
                    </div>
                  </div>
                )}
                <div className={`grid ${debugMode === 'CONTRAST' ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
                  {renderDebugPanel('PRIMARY')}
                  {debugMode === 'CONTRAST' && renderDebugPanel('CONTRAST')}
                </div>
            </div>
        </div>

        {/* Fixed Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-between items-center z-10">
            <button
                onClick={() => {
                setUserPrompt('');
                setResponse('');
                }}
                className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1.5 text-sm px-3 py-2 rounded-md hover:bg-gray-200 font-medium"
            >
                <Trash2 size={16} />
                Clear Input
            </button>

            <div className="flex items-center gap-3">
                <button
                    onClick={handleBackToDebuggerList}
                    className="text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                >
                    取消
                </button>
                <button
                    onClick={() => alert('保存成功！')}
                    className="text-blue-600 bg-white hover:bg-blue-50 border border-blue-600 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-all text-sm"
                >
                    <Save size={16} />
                    保存
                </button>
                {isGenerating ? (
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
                    disabled={!userPrompt.trim()}
                    className={`px-6 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-all transform active:scale-95 text-sm ${
                        !userPrompt.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-200'
                    }`}
                    >
                    <Play size={16} fill="currentColor" />
                    运行调试
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default PromptDebugger;
