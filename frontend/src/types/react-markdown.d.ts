declare module 'react-markdown' {
  import * as React from 'react';

  export interface Components {
    [element: string]: React.ElementType | undefined;
  }

  interface ReactMarkdownProps {
    children?: React.ReactNode;
    components?: Components;
  }

  const ReactMarkdown: React.FC<ReactMarkdownProps>;

  export default ReactMarkdown;
}

