PROJECT_NAME=weblibdedx
WASM_FILENAME=$PROJECT_NAME.wasm
WASM_PUBLIC=../public/$WASM_FILENAME
PROPER_PATH="\/web_dev\/$WASM_FILENAME"
JS=../src/Backend/$PROJECT_NAME.js
WASM_LOOKUP="wasmBinaryFile = locateFile"

emcmake cmake -S . -B ./build

cd ./build

emmake make -j4

ls -al

FUNCTIONS='['

FUNCTIONS+='_dedx_get_program_list'

FUNCTIONS+=']'

emcc ./bin/libdedx.a -o weblibdedx.js -s EXPORTED_FUNCTIONS="$FUNCTIONS" -s USE_ES6_IMPORT_META=0 -s EXPORT_ES6=1 -s MODULARIZE=1 -s WASM=1

ls -al ./bin

echo -------

ls -al ..

cp ${WASM_FILENAME} ${WASM_PUBLIC}

sed -i '1s;^;\/* eslint-disable *\/\n;' ${JS}
sed -i "s/$WASM_FILENAME/$PROPER_PATH/" ${JS}
sed -i "s/$WASM_LOOKUP/\/\/$WASM_LOOKUP/" ${JS}



cd ..