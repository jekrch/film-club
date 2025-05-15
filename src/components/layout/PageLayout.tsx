import classNames from 'classnames';
import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children, className }) => {
  return (
    <div className={classNames(`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-1`, className)}>
      {children}
    </div>
  );
};

export default PageLayout;