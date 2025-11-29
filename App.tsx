import React, { useState } from 'react';
import { Tab } from './types';
import TestingList from './components/TestingList';
import PromptDebugger from './components/PromptDebugger';
import { LayoutList, ClipboardList, BarChart2, TerminalSquare, Plus } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.TESTING_LIST);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.TESTING_LIST:
        return <TestingList />;
      case Tab.PROMPT_DEBUG:
        return <PromptDebugger />;
      case Tab.TASK_LIST:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
              <p>Task List Module Placeholder</p>
            </div>
          </div>
        );
      case Tab.TEST_EVALUATION:
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <BarChart2 size={48} className="mx-auto mb-4 opacity-20" />
              <p>Test Evaluation Module Placeholder</p>
            </div>
          </div>
        );
      default:
        return <TestingList />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header Section */}
      <header className="bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="px-6 py-4 flex flex-col gap-4">
            
          {/* Top Row: Title */}
          <div className="flex items-center justify-between">
             <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
               <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
               测试中心
             </h1>
             
             {/* Only show 'New Test Set' on relevant tabs to match usual UX, 
                 but keeping it generally visible as per screenshot's layout suggestion */}
             <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded shadow-sm transition-colors flex items-center gap-2">
               <Plus size={16} />
               新建测试集
             </button>
          </div>

          {/* Bottom Row: Tabs */}
          <nav className="flex items-center gap-1 pt-1">
            <button
              onClick={() => setActiveTab(Tab.TESTING_LIST)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors duration-200 flex items-center gap-2 ${
                activeTab === Tab.TESTING_LIST
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <LayoutList size={16} />
              测试列表
            </button>
            <button
              onClick={() => setActiveTab(Tab.TASK_LIST)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors duration-200 flex items-center gap-2 ${
                activeTab === Tab.TASK_LIST
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <ClipboardList size={16} />
              任务列表
            </button>
            <button
              onClick={() => setActiveTab(Tab.TEST_EVALUATION)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors duration-200 flex items-center gap-2 ${
                activeTab === Tab.TEST_EVALUATION
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
               <BarChart2 size={16} />
              测试评估
            </button>
            
            {/* The New Tab */}
            <button
              onClick={() => setActiveTab(Tab.PROMPT_DEBUG)}
              className={`ml-2 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors duration-200 flex items-center gap-2 ${
                activeTab === Tab.PROMPT_DEBUG
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/30'
              }`}
            >
              <TerminalSquare size={16} />
              Prompt调试
              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">NEW</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;