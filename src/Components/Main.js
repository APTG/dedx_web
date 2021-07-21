import ContentWrapper from "./ContentWrapper"
import Footer from "./Footer"

const Main : any = props =>{
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