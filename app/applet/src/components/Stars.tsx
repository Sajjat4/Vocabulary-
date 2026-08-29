import React, { useMemo } from 'react';

export default function Stars() {
  const stars = useMemo(() => {
    const starArray = [];
    for (let i = 0; i < 150; i++) {
      const top = Math.random() * 100 + '%';
      const left = Math.random() * 100 + '%';
      const sizeClass = Math.random() > 0.85 ? 'star-lg' : Math.random() > 0.6 ? 'star-md' : 'star-sm';
      const animationDuration = (Math.random() * 4 + 3) + 's';
      const animationDelay = (Math.random() * 5) + 's';
      starArray.push(
        <div 
          key={i} 
          className={`star ${sizeClass}`} 
          style={{ top, left, animationDuration, animationDelay }}
        />
      );
    }
    return starArray;
  }, []);

  return <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">{stars}</div>;
}
