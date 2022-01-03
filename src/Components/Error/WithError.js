import { useState } from "react";
import ErrorComponent from "./ErrorComponent";

/*
    There aren't any known corner-cases that throw dedx errors
    if the UI is used properly. That said this function is ready to provide
    descriptions if needed in the future.
*/
function getErrorDescription(code){
    return `Dedx error with code: ${code}`
}

function withError(WrappedComponent) {
    return function WithError() {
        const [error, setError] = useState(undefined)

        let errorDisplay = false

        if(error){
            if(isNaN(error.error)){
                errorDisplay = {
                    description: error.error.message || "Unknown error",
                    fallbackStrategy: error.fallbackStrategy
                }
            } else {
                errorDisplay = {
                    errorCode: error.error,
                    description: getErrorDescription(error.error),
                    fallbackStrategy: error.fallbackStrategy
                }
            }
        }

        return (
            <div>
                {errorDisplay && <ErrorComponent {...errorDisplay} />}
                <WrappedComponent setError={setError} />
            </div>
        )
    }
}



export default withError