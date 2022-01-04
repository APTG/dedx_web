import React, {useEffect} from 'react';
import './App.css';

import Main from './Components/Main';

function App() {
  useEffect(() => {
    document.title = "libdEdx web"
  }, []);

  return (
    <div>
      <Main />
    </div>
  );
}

export default App;
