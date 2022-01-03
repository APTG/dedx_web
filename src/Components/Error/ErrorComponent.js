import './Error.css'

function ErrorComponent({ errorCode, description, fallbackStrategy }) {
    return (
        <div className='error-wrapper'>   
            <div className='error column-flex'>
                <h3>Oops... something went wrong</h3>
                {errorCode && <div>Error code: {errorCode}</div>}
                <label>{description}</label>
                <input type='button' className='button' onClick={fallbackStrategy} value={'Take me back'}/>
            </div>
            <div className='error-underlay' />
        </div>
    )
}

export default ErrorComponent