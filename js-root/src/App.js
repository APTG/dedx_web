import React from 'react';
import './App.css';

import ContentWrapper from './Components/ContentWrapper';


const onLoad = ()=>{
  console.log("Scripd done - outside");
}

function App() {

  return (
    <>
    <div>HELLO</div>
    <ContentWrapper asyncScriptOnLoad ={onLoad}/>,
    </>
  );
}



export default App;
