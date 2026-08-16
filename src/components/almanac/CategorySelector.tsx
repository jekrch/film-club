import Button from '../common/Button';
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
    onSelectCategory,
}) => {
    return (
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 border-b border-slate-700/60 pb-3">
            {categories.map((category) => (
                <Button
                    key={category}
                    onClick={() => onSelectCategory(category)}
                    variant="chip"
                    size="sm"
                    active={selectedCategory === category}
                    aria-pressed={selectedCategory === category}
                >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                </Button>
            ))}
        </div>
    );
};

export default CategorySelector;
