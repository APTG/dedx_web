$PROJECT_NAME = "weblibdedx"
$WASM_FILENAME = $PROJECT_NAME.wasm
$WASM_PUBLIC = ../public/$WASM_FILENAME
$PROPER_PATH = /web_dev/$WASM_FILENAME
$JS = ../src/Backend/$PROJECT_NAME.js

emcmake cmake ../libdedx
emmake make -j4

$WASM_LOOKUP = 'wasmBinaryFile = locateFile'

$FUNCTIONS='['

$FUNCTIONS += '_dedx_get_program_list'

$FUNCTIONS += ']'

emcc libdedx.a -s EXPORTED_FUNCTIONS="$FUNCTIONS" -s ENVIRONMENT='web' -s USE_ES6_IMPORT_META=0 -s EXPORT_ES6=1 -s MODULARIZE=1 -s WASM=1

cp ${WASM_FILENAME} ${WASM_PUBLIC}

sed -i.old '1s;^;\/* eslint-disable *\/;' ${JS}
sed -i 's|$PROJECT_NAME|$PROPER_PATH|' ${JS}
sed -i 's|$WASM_LOOKUP|// $WASM_LOOKUP|' ${JS}