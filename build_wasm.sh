PROJECT_NAME=weblibdedx
WASM_PUBLIC=./public/$PROJECT_NAME.wasm
PROPER_PATH="\/web_dev\/$PROJECT_NAME.wasm"
JS=./src/Backend/$PROJECT_NAME.js
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

emcc libdedx.a -o $PROJECT_NAME.js -s EXPORTED_FUNCTIONS="$FUNCTIONS" -s EXPORT_ES6=1 -s MODULARIZE=1 -s WASM=1

ls -al

cd ../..

cp libdedx/build/libdedx/$PROJECT_NAME.js $JS
cp libdedx/build/libdedx/WASM_FILENAME $WASM_PUBLIC

rm -d libdedx/build/libdedx/

sed -i '1s;^;\/* eslint-disable *\/\n;' ${JS}
sed -i "s/$PROJECT_NAME.wasm/$PROPER_PATH/" ${JS}
sed -i "s/$WASM_LOOKUP/\/\/$WASM_LOOKUP/" ${JS}