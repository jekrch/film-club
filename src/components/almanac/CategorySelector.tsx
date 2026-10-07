import Button from '../common/Button';

interface CategorySelectorProps<T extends string> {
    categories: T[];
    /** The chip label for each category. */
    labels: Record<T, string>;
    selectedCategory: T;
    onSelectCategory: (category: T) => void;
}

const CategorySelector = <T extends string>({
    categories,
    labels,
    selectedCategory,
    onSelectCategory,
}: CategorySelectorProps<T>) => {
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
                    {labels[category]}
                </Button>
            ))}
        </div>
    );
};

export default CategorySelector;
