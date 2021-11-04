cd ./libdedx

emcmake cmake . -B ./build

cd ./build

emmake cmake --build .
cd libdedx

emcc libdedx.a -o weblibdedx.js -s EXPORTED_FUNCTIONS=['_dedx_get_program_list','_dedx_get_material_list','_dedx_get_ion_list','_dedx_get_min_energy','_dedx_get_max_energy','_dedx_get_ion_name','_dedx_get_material_name','_dedx_get_program_name','_malloc','_free'] -s ENVIRONMENT='web' -s USE_ES6_IMPORT_META=0 -s EXPORT_ES6=1 -s MODULARIZE=1 -s WASM=1 -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap","UTF8ToString"]

cd ../../..

cp ./libdedx/build/libdedx/weblibdedx.js ./src/Backend
cp ./libdedx/build/libdedx/weblibdedx.wasm ./public

sed -i '1s;^;\/* eslint-disable *\/\n;' ./src/Backend/weblibdedx.js
sed -i "s/weblibdedx.wasm/\/web_dev\/weblibdedx.wasm/" ./src/Backend/weblibdedx.js
sed -i "s/wasmBinaryFile = locateFile/\/\/wasmBinaryFile = locateFile/" ./src/Backend/weblibdedx.js

rm -r libdedx/build
