import {defs, tiny} from "./common.js";

// Pull these names into this module's scope for convenience:
const {
    vec, vec3, vec4, color, Matrix, Mat4, Shader, Texture,
} = tiny;

export class Shape_From_File extends tiny.Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                                    // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                throw "OBJ file loader:  OBJ file either not found or is of unsupported format."
            })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        let verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        let lines = data.split('\n');

        let VERTEX_RE = /^v\s/;
        let NORMAL_RE = /^vn\s/;
        let TEXTURE_RE = /^vt\s/;
        let FACE_RE = /^f\s/;
        let WHITESPACE_RE = /\s+/;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            let elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                let quad = false;
                for (let j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        let vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (let j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(caller, uniforms, model_transform, material) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(caller, uniforms, model_transform, material);
    }
}

export class Fog extends defs.Fake_Bump_Map {
    // **Repeated_Texture** is a Phong Shader extended to addditionally decal a
    // texture image over the drawn shape, lined up according to the texture
    // coordinates that are stored at each shape vertex.

    shared_glsl_code() {
        return super.shared_glsl_code() + `
            varying vec4 point_position;
            `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            attribute vec2 texture_coord;
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                point_position = model_transform * vec4(position, 1.0);
                                
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                // Turn the per-vertex texture coordinate into an interpolated variable.
                f_tex_coord = texture_coord;
              } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
    
            void main(){
                // Sample the texture image in the correct place:
                vec4 tex_color = texture2D( texture, f_tex_coord );
                if( tex_color.w < .01 ) discard;
                
                // Slightly disturb normals based on sampling the same image that was used for texturing:
                vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
                
                // Compute an initial (ambient) color:
                gl_FragColor = vec4( mix(tex_color.xyz * ambient , shape_color.xyz, 
                                     smoothstep(0., 1., distance(vec4(0, 0, 0, 0), point_position) / 100.)) , 1 ); 
                
                // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
              } `;
    }
}

export class Smooth_Noise extends defs.Phong_Shader {
    // **Smooth_Noise**: A simple "procedural" texture shader representing
    // clouds using a simple noise generator.
    update_GPU(context, gpu_addresses, program_state, model_transform, material) {
        // update_GPU():  Define how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [program_state.projection_transform, program_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false, Mat4.flatten_2D_to_1D(PCM.transposed()));
        context.uniform1f(gpu_addresses.animation_time, program_state.animation_time / 1000);

        // Allow color to be passed in from material declaration.
        context.uniform4fv(gpu_addresses.shape_color, material.color);

    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `precision mediump float;
                varying vec2 f_tex_coord;
                uniform vec4 shape_color;
            `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
                attribute vec3 position;                            
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                uniform mat4 projection_camera_model_transform;
        
                void main(){ 
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );   
                    // The vertex's final resting place (in NDCS).
                    f_tex_coord = texture_coord;                                       
                    // Directly use original texture coords and interpolate between.
                }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
                uniform float animation_time;
                
                float random (vec2 uv) {
                    return fract(sin(dot(uv.xy, vec2(125., 262.))) * 16348.);
                }
                
                float noise (vec2 uv) {
                    vec2 i = floor(uv);
                    vec2 f = fract(uv);
                    f = smoothstep(0., 1., f);
                    
                    // TODO: Offset correctly across shape end so that it wraps to the beginning!
                    float a = random(i);
                    float b = random(i + vec2(1, 0));
                    float c = random(i + vec2(0, 1));
                    float d = random(i + vec2(1, 1));
                    
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }
                
                void main(){               
                    float a = animation_time;
                    vec2 uv = vec2(f_tex_coord.x + (a / 30.), f_tex_coord.y);
                    
                    // We first define a 'base' noise color component.
                    vec3 color = vec3(noise(uv * 4.));
                    // We then layer additional 'sharper' base noise components on top of the first.
                    for (int i = 1; i <= 4; i++)
                        color += vec3(noise(uv * pow(2., float(i + 2)))) * (0.5 / float(i));
                    // Softening the resulting noise component.
                    color /= 2.;
                    
                    // We will finally mix the noise component with the material defined color.                 
                    gl_FragColor = vec4(mix(vec3(1.), shape_color.xyz, color), 1);
                }`;
    }
}

export class Ground_Fog extends defs.Fake_Bump_Map {
    // **Repeated_Texture** is a Phong Shader extended to addditionally decal a
    // texture image over the drawn shape, lined up according to the texture
    // coordinates that are stored at each shape vertex.

    shared_glsl_code() {
        return super.shared_glsl_code() + `
            varying vec4 point_position;
            varying vec4 center;
            `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            attribute vec2 texture_coord;
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                point_position = model_transform * vec4(position, 1.0);
                center         = model_transform * vec4(0, 0, 0, 1.0);
                
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                // Turn the per-vertex texture coordinate into an interpolated variable.
                f_tex_coord = texture_coord;
              } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
    
            void main(){
                // Sample the texture image in the correct place:
                vec4 tex_color = texture2D( texture, f_tex_coord );
                if( tex_color.w < .01 ) discard;
                
                // Slightly disturb normals based on sampling the same image that was used for texturing:
                vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
                
                // Compute an initial (ambient) color:
                gl_FragColor = vec4( mix(tex_color.xyz * ambient , shape_color.xyz, 
                                     smoothstep(0., 1., distance(center, point_position) / 100.)) , 1 ); 
                
                // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
              } `;
    }
}

export class Wall_Texture extends defs.Textured_Phong {
    // **Repeated_Texture** is a Phong Shader extended to addditionally decal a
    // texture image over the drawn shape, lined up according to the texture
    // coordinates that are stored at each shape vertex.

    shared_glsl_code() {
        return super.shared_glsl_code() + `
            `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                    // Turn the per-vertex texture coordinate into an interpolated variable.
                    f_tex_coord = texture_coord;
                  } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
    
            void main() {   
                vec3 tmp = N;
                vec4 tex_color;
                vec2 repeat_up_bottom = vec2(1, 5);
                
                // I have no idea what tmp is, but this would scale the texture better
                if (tmp.x != 0.0 && tmp.y != 0.0) {
                    tex_color = texture2D( texture, f_tex_coord );
                } else if (tmp.z != 0.0) {
                    tex_color = texture2D( texture, vec2(mod(f_tex_coord.x * repeat_up_bottom.x, 1.), mod(f_tex_coord.y * repeat_up_bottom.y, 1.)));
                } else {
                    tex_color = texture2D( texture, vec2(mod(f_tex_coord.x * repeat_up_bottom.x, 1.), mod(f_tex_coord.y * repeat_up_bottom.y, 1.)));
                }
                if( tex_color.w < .01 ) discard;
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            } `;
    }
}

export class Rasengan_Texture extends defs.Textured_Phong {
    // **Repeated_Texture** is a Phong Shader extended to addditionally decal a
    // texture image over the drawn shape, lined up according to the texture
    // coordinates that are stored at each shape vertex.

    shared_glsl_code() {
        return super.shared_glsl_code() + `
            `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                    // Turn the per-vertex texture coordinate into an interpolated variable.
                    f_tex_coord = texture_coord;
                  } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
    
            void main() {   
                vec4 tex_color = texture2D( texture, f_tex_coord);

                // if( tex_color.w < .01 ) discard;
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            } `;
    }
}