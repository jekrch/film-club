const CorinthianPillar: React.FC<{ 
  side: 'left' | 'right'; 
  className?: string;
  flipped?: boolean;
  width?: number; // pixel width for the pillar
}> = ({ side, className = '', flipped = false, width = 40 }) => {
  const positionClass = side === 'left' 
    ? 'left-0 sm:left-2 lg:left-8' 
    : '-right-2 sm:right-0 lg:right-8';

  // Scale factor based on desired width (original viewBox width is 50)
  const scale = width / 50;
  
  // Scaled dimensions
  const capitalHeight = Math.round(18 * scale);
  const shaftWidth = Math.round(22 * scale);
  const shaftX = Math.round(14 * scale);
  const baseWidths = [26, 30, 34].map(w => Math.round(w * scale));
  const baseXs = [12, 10, 8].map(x => Math.round(x * scale));
  
  // Fluting positions (evenly spaced within shaft)
  const flutePositions = [17, 21, 25, 29, 33].map(x => Math.round(x * scale));
  const fluteStroke = Math.max(0.5, 0.75 * scale);

  if (!flipped) {
    const totalHeight = Math.round(200 * scale);
    return (
      <svg
        viewBox={`0 0 ${width} ${totalHeight}`}
        width={width}
        height={totalHeight}
        className={`absolute top-2 ${positionClass} opacity-15 transition-opacity duration-500 ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Capital */}
        <rect x={baseXs[2]} y={Math.round(2 * scale)} width={baseWidths[2]} height={Math.round(4 * scale)} rx={scale} fill="currentColor" className="text-slate-200" />
        <rect x={baseXs[1]} y={Math.round(8 * scale)} width={baseWidths[1]} height={Math.round(3 * scale)} rx={0.5 * scale} fill="currentColor" className="text-slate-200" />
        <rect x={baseXs[0]} y={Math.round(13 * scale)} width={baseWidths[0]} height={Math.round(2.5 * scale)} rx={0.5 * scale} fill="currentColor" className="text-slate-200" />
        
        {/* Shaft */}
        <rect x={shaftX} y={Math.round(17 * scale)} width={shaftWidth} height={Math.round(166 * scale)} fill="currentColor" className="text-slate-200" />
        
        {/* Fluting */}
        {flutePositions.map((x, i) => (
          <line key={i} x1={x} y1={Math.round(19 * scale)} x2={x} y2={Math.round(181 * scale)} stroke="currentColor" strokeWidth={fluteStroke} className="text-slate-400" />
        ))}
        
        {/* Base */}
        <rect x={baseXs[0]} y={Math.round(185 * scale)} width={baseWidths[0]} height={Math.round(2.5 * scale)} rx={0.5 * scale} fill="currentColor" className="text-slate-200" />
        <rect x={baseXs[1]} y={Math.round(190 * scale)} width={baseWidths[1]} height={Math.round(3 * scale)} rx={0.5 * scale} fill="currentColor" className="text-slate-200" />
        <rect x={baseXs[2]} y={Math.round(195 * scale)} width={baseWidths[2]} height={Math.round(4 * scale)} rx={scale} fill="currentColor" className="text-slate-200" />
      </svg>
    );
  }

  // Flipped: capital at top (fixed size), shaft stretches down
  return (
    <div 
      className={`absolute top-0 ${positionClass} h-full flex flex-col opacity-15 transition-opacity duration-500 ${className}`}
      style={{ width: `${width}px` }}
      aria-hidden="true"
    >
      {/* Capital - fixed height, crisp rendering */}
      <svg
        viewBox={`0 0 ${width} ${capitalHeight}`}
        width={width}
        height={capitalHeight}
        className="flex-shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x={baseXs[2]} y={Math.round(2 * scale)} width={baseWidths[2]} height={Math.round(4 * scale)} rx={scale} fill="currentColor" className="text-slate-200" />
        <rect x={baseXs[1]} y={Math.round(8 * scale)} width={baseWidths[1]} height={Math.round(3 * scale)} rx={0.5 * scale} fill="currentColor" className="text-slate-200" />
        <rect x={baseXs[0]} y={Math.round(13 * scale)} width={baseWidths[0]} height={Math.round(2.5 * scale)} rx={0.5 * scale} fill="currentColor" className="text-slate-200" />
      </svg>
      
      {/* Shaft - stretches to fill remaining height */}
      <svg
        viewBox={`0 0 ${width} 100`}
        className="w-full flex-grow"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <rect x={shaftX} y="0" width={shaftWidth} height="100" fill="currentColor" className="text-slate-200" />
        {flutePositions.map((x, i) => (
          <line key={i} x1={x} y1="0" x2={x} y2="100" stroke="currentColor" strokeWidth={fluteStroke} className="text-slate-700" />
        ))}
      </svg>
    </div>
  );
};

export default CorinthianPillar;