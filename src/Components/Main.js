import ContentWrapper from "./ContentWrapper"
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