import React from 'react';
import './App.css';

import ContentWrapper from './Components/ContentWrapper';


const onLoad = ()=>{
  console.log("Scripd done - outside");
}

function App() {

  return (
    <div>
    <ContentWrapper asyncScriptOnLoad ={onLoad}/>
    </div>
  );
}



export default App;
