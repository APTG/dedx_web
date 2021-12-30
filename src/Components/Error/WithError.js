import { useState } from "react";
import ErrorComponent from "./ErrorComponent";

function getErrorDescription(code){
    return {description:`error ${code}`}
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
                    code: error.error,
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