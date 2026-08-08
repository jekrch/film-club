import React from 'react';

type ChartCategory = 'country' | 'language' | 'decade';

interface CategorySelectorProps {
    categories: ChartCategory[];
    selectedCategory: ChartCategory;
    onSelectCategory: (category: ChartCategory) => void;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
    categories,
    selectedCategory,
    onSelectCategory
}) => {
    return (
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 border-b border-slate-700/60 pb-3">
            {categories.map(category => (
                <button
                    key={category}
                    onClick={() => onSelectCategory(category)}
                    // Active state uses blue to match the accent of the chart card it controls
                    className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ease-out whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-825 focus:ring-blue-500 ${
                        selectedCategory === category
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
            ))}
        </div>
    );
};

export default CategorySelector;