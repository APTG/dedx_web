PROJECT_NAME=weblibdedx
WASM_FILENAME=$PROJECT_NAME.wasm
WASM_PUBLIC=../public/$WASM_FILENAME
PROPER_PATH="\/web_dev\/$WASM_FILENAME"
JS=../src/Backend/$PROJECT_NAME.js
WASM_LOOKUP="wasmBinaryFile = locateFile"

cd ./libdedx

emcmake cmake . -B ./build

cd ./build

emmake cmake --build .
cd libdedx

ls -al

FUNCTIONS='['

FUNCTIONS+='_dedx_get_program_list'

FUNCTIONS+=']'

emcc libdedx.a -s EXPORTED_FUNCTIONS="$FUNCTIONS" -s EXPORT_ES6=1 -s MODULARIZE=1 -s WASM=1

ls -al

echo -------

ls -al ..

# cp ${WASM_FILENAME} ${WASM_PUBLIC}

# sed -i '1s;^;\/* eslint-disable *\/\n;' ${JS}
# sed -i "s/$WASM_FILENAME/$PROPER_PATH/" ${JS}
# sed -i "s/$WASM_LOOKUP/\/\/$WASM_LOOKUP/" ${JS}