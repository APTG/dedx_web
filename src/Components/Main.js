import ContentWrapper from "./ContentWrapper"  // skipcq: JS-E1007, JS-P1003, JS-W1028, JS-W1029
import Footer from "./Footer/Footer"
import React from 'react'

const Main = () => {
    return (
        <>
            <div className="site-wrapper">
                <ContentWrapper />
            </div>
            <Footer />
        </>
    )
}

export default Main;