PROJECT_NAME=weblibdedx
PROPER_PATH="\/web_dev\/$PROJECT_NAME.wasm"
JS=./src/Backend/$PROJECT_NAME.js
WASM_LOOKUP="wasmBinaryFile = locateFile"

cd ./libdedx

emcmake cmake . -B ./build

cd ./build

emmake cmake --build .
cd libdedx

FUNCTIONS='['

FUNCTIONS+='_dedx_get_program_list,'
FUNCTIONS+='_dedx_get_material_list,'
FUNCTIONS+='_dedx_get_ion_list,'
FUNCTIONS+='_dedx_get_ion_name,'
FUNCTIONS+='_dedx_get_material_name,'
FUNCTIONS+='_dedx_get_program_name,'
FUNCTIONS+='_dedx_get_min_energy,'
FUNCTIONS+='_dedx_get_max_energy,'
FUNCTIONS+='_dedx_get_simple_stp,'
FUNCTIONS+='_malloc,'
FUNCTIONS+='_free'

FUNCTIONS+=']'

# remember to use --embed-file instead of --preload-file for web based development
emcc libdedx.a -o $PROJECT_NAME.js -s EXPORTED_FUNCTIONS="$FUNCTIONS" -s ENVIRONMENT='web' -s USE_ES6_IMPORT_META=0 -s EXPORT_ES6=1 -s MODULARIZE=1 -s WASM=1 -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap","UTF8ToString"] --embed-file ../../libdedx/data@data/

cd ../../..

cp ./libdedx/build/libdedx/$PROJECT_NAME.js ./src/Backend
cp ./libdedx/build/libdedx/$PROJECT_NAME.wasm ./public
cp ./libdedx/build/libdedx/$PROJECT_NAME.data ./public

sed -i '1s;^;\/* eslint-disable *\/\n;' ${JS}
sed -i "s/$PROJECT_NAME.wasm/$PROPER_PATH/" ${JS}
sed -i "s/$WASM_LOOKUP/\/\/$WASM_LOOKUP/" ${JS}

#cleanup
rm -r libdedx/build