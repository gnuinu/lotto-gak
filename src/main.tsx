import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './App.tsx';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root 를 찾을 수 없습니다');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 오프라인 동작용 서비스 워커. 새 버전이 배포되면 다음 방문에 자동 적용된다.
registerSW({ immediate: true });
