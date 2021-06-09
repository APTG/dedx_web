import ContentWrapper from "./ContentWrapper"
import Footer from "./Footer"

const Main = props =>{
    return(
        <>
        <div className="site-wrapper">
            <ContentWrapper />
        </div>
        <Footer/>
        </>
    )
}

export default Main;