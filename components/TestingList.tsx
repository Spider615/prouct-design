import React from 'react';
import { Layers, Plus } from 'lucide-react';

const TestingList: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-white p-8">
      <div className="max-w-md w-full flex flex-col items-center text-center">
        {/* Illustration Placeholder - Using Icons to simulate the vibe */}
        <div className="mb-8 relative">
           <div className="w-48 h-48 bg-blue-50 rounded-full flex items-center justify-center relative overflow-hidden">
              <Layers size={80} className="text-blue-500 opacity-80" />
              <div className="absolute bottom-4 right-10 w-8 h-8 bg-yellow-300 rounded-full opacity-50 blur-xl"></div>
              <div className="absolute top-10 left-10 w-12 h-12 bg-purple-300 rounded-full opacity-40 blur-xl"></div>
           </div>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-2">
          当前还没有测试集
        </h3>
        <p className="text-gray-500 text-sm mb-8">
          快点击“快速创建测试集”，开启您的测试之旅吧
        </p>

        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md shadow-sm transition-colors duration-200 flex items-center gap-2">
           <Plus size={18} />
           快速创建测试集
        </button>
      </div>
    </div>
  );
};

export default TestingList;