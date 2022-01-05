PROJECT_NAME=weblibdedx
# Fixed path doesn't try to read the process.env.PUBLIC_URL variable
# It places the whole literal "${process.env.PUBLIC_URL}" inside the .js code 
# to later be interpreted in react build process
FIXED_PATH="\${process.env.PUBLIC_URL}\/$PROJECT_NAME.wasm"
JS=./src/Backend/$PROJECT_NAME.js
WASM_LOOKUP="wasmBinaryFile = locateFile"

cd ./libdedx

emcmake cmake . -B ./build

cd ./build

emmake cmake --build .
cd libdedx

FUNCTIONS='['

FUNCTIONS+='_dedx_fill_program_list,'
FUNCTIONS+='_dedx_fill_material_list,'
FUNCTIONS+='_dedx_fill_ion_list,'
FUNCTIONS+='_dedx_get_ion_name,'
FUNCTIONS+='_dedx_get_material_name,'
FUNCTIONS+='_dedx_get_program_name,'
FUNCTIONS+='_dedx_get_min_energy,'
FUNCTIONS+='_dedx_get_max_energy,'
FUNCTIONS+='_dedx_get_simple_stp,'
FUNCTIONS+='_convert_units,'
FUNCTIONS+='_dedx_get_stp_table,'
FUNCTIONS+='_dedx_get_csda_range_table,'
FUNCTIONS+='_dedx_get_simple_stp_for_program,'
FUNCTIONS+='_dedx_get_stp_table_size,'
FUNCTIONS+='_dedx_fill_default_energy_stp_table,'
FUNCTIONS+='__dedx_read_density,'
FUNCTIONS+='_malloc,'
FUNCTIONS+='_free'

FUNCTIONS+=']'

# remember to use --embed-file instead of --preload-file for web based development
# # Embed- as opposed to preload - embeds the data into the output .js file. 
# They both should have the same effect - the data should be available on the site 
# but the preload option requires the generated .js file to load the file when it sets the module up. 
# This wasn't working correctly - it seemed to have some problems fetching the file, 
# either caused by CORS or some other reason. 
# On the other hand, the embed option worked flawlessly without messing with the generated code anymore. 
# Yes, it is somewhat less efficient - the data is stored and fetched as text 
# (whereas with preload it should be fetched as binary) 
# but the size of our dataset isn't staggering 
# so it doesn't cause much of a slowdown. 
# In short it's more comfortable and reliable when using the generated file as a react module.
emcc libdedx.a -o $PROJECT_NAME.js -s EXPORTED_FUNCTIONS="$FUNCTIONS" -s ENVIRONMENT='web' -s USE_ES6_IMPORT_META=0 -s EXPORT_ES6=1 -s MODULARIZE=1 -s WASM=1 -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap","UTF8ToString"] -s ALLOW_MEMORY_GROWTH=1 --embed-file ../../libdedx/data@data/

ls -al

cd ../../..

cp ./libdedx/build/libdedx/$PROJECT_NAME.js ./src/Backend
cp ./libdedx/build/libdedx/$PROJECT_NAME.wasm ./public

sed -i '1s;^;\/* eslint-disable *\/\n;' ${JS}
sed -i "s/'$PROJECT_NAME.wasm'/\`$FIXED_PATH\`/g" ${JS}
sed -i "s/$WASM_LOOKUP/\/\/$WASM_LOOKUP/" ${JS}

#cleanup
rm -r libdedx/build