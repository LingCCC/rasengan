import {defs, tiny} from './utils/common.js';
import * as proj from './utils/common-shaders.js'
import {Simulation} from "./utils/collision-demo.js";
import {Text_Line} from "./utils/text-demo.js";

const { vec3, vec4, color, hex_color, Texture, Mat4, Light, Material, } = tiny;

//CREDIT TO collision-demo.js for much of the collision detection code

export class Rasengan extends Simulation {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // These two callbacks will step along s and t of the second sheet:
        const row_operation_2 = (s) => vec3(-1, Math.random() * 100, 2 * s - 1);
        const column_operation_2 = (t, p, s) => vec3(2 * t - 1, Math.random() * 100, 2 * s - 1);

        this.colliders = [
            {intersect_test: Body.intersect_sphere, points: new defs.Subdivision_Sphere(1), leeway: .5},
            {intersect_test: Body.intersect_sphere, points: new defs.Subdivision_Sphere(2), leeway: .3},
            {intersect_test: Body.intersect_cube, points: new defs.Cube(), leeway: .1}
        ];

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            torus: new defs.Torus(15, 15),
            torus2: new defs.Torus(3, 15),
            sphere: new defs.Subdivision_Sphere(4),
            circle: new defs.Regular_2D_Polygon(1, 15),
            square: new defs.Square(),
            cube: new defs.Cube(),
            limb: new defs.Rounded_Capped_Cylinder(50, 50),
            sheet2: new defs.Grid_Patch(10, 50,
                row_operation_2, column_operation_2),
            dirt_patch: new defs.Grid_Patch(10, 10,
                (s) => vec3(-1, row_operation_2 * 5, 2 * s - 1),
                (t, p, s) => vec3(2 * t - 1, column_operation_2 * 5, 2 * s - 1)),
            ground: new defs.Cube(),
            tree: new proj.Shape_From_File('./assets/tree.obj'),
            text: new Text_Line(35),
        };

        this.shapes.ground.arrays.texture_coord.forEach(vec2 => vec2.scale_by(100));

        // Materials:
        const phong = new defs.Phong_Shader(1);
        new defs.Fake_Bump_Map(1);
        const texture = new defs.Textured_Phong(1);
        this.text_image = new Material(texture, {
            ambient: 1, diffusivity: 0, specularity: 0,
            texture: new Texture("assets/text.png")
        });
        this.grey = new Material(phong, {
            color: color(.5, .5, .5, 1), ambient: 0,
            diffusivity: .3, specularity: .5, smoothness: 10
        })

        this.collider_selection = 0;

        // *** Materials
        this.materials = {
            // *** Environment Materials ***
            sky: new Material(new proj.Smooth_Noise(),
                {ambient: 1, color: hex_color('#87CEEB')}),
            ground: new Material(new proj.Fog(),
                {
                    ambient: 0.7, diffuse: 0.5, specularity: 0.7, smoothness: 15,
                    color: hex_color('#91b1c0'), texture: new Texture('./assets/cobble.jpg')
                }),
            background: new Material(new defs.Phong_Shader(),
                {ambient: 0.85, diffuse: 1, specularity: 0, color: hex_color('#b2daec')}),
            moss: new Material(new proj.Fog(),
                {
                    ambient: 0.7, diffuse: 0.5, specularity: 0.0, smoothness: 15,
                    color: hex_color('#91b1c0'), texture: new Texture('./assets/pine.jpg')
                }),

            // *** Character Materials ***
            rasengan: new Material(new proj.Rasengan_Texture(),
                {ambient: 1, texture: new Texture('./assets/rasengan.jpg')}),
            limb: new Material(new defs.Phong_Shader(),
                {ambient: 1, color: hex_color("#FF9000")}),
            head: new Material(new defs.Phong_Shader(),
                {ambient: 1, color: hex_color("#e7b27c")}),
            body: new Material(new defs.Phong_Shader(),
                {ambient: 1, color: hex_color("#FF0000")}),
            wall: new Material(new proj.Wall_Texture(),
                {ambient: 1, texture: new Texture('./assets/wall.jpg')}),
            //making a collider
            collider_mat: new Material(new defs.Phong_Shader(),
                {ambient: 1, color: color(1, 1, 1, 0.1)}),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 75), vec3(0, 0, 0), vec3(0, 1, 0));

        this.position = Mat4.identity();
        document.addEventListener("keydown", this.key_press_handler.bind(this));
        document.addEventListener("keyup", this.key_up_handler.bind(this));


        this.rasengan = false;
        this.wall = true;
        //direction naruto is facing
        this.dir = "right";
        this.max_rasengan = 4;
        this.rasengan_count = 0;
        this.time = 60;
        this.score = 0;
        this.scores = {"Ling": 1, "R": 2, "Valentin": 10, "Apply": 20, "LOL": 5};
        this.game_start = false;
        this.username = 'Anonymous';
    }

    key_up_handler(event) {
        if (event.key === "l") {
            // right
            this.bodies[0].linear_velocity[0] = 0;
        }
        if (event.key === "j") {
            // left
            this.bodies[0].linear_velocity[0] = 0;
        }
    }

    key_press_handler(event) {
        //console.log("Keypress " + event.key)
        if (event.key === "i") {
            // up
            if (this.bodies[0].linear_velocity[1] === 0) {
                this.bodies[0].linear_velocity[1] += 10;
                this.bodies[0].grounded = false;
            }
        }
        if (event.key === "j") {
            // left
            this.dir = "left"
            this.bodies[0].linear_velocity[0] = -2;
        }
        if (event.key === "l") {
            // right
            this.dir = "right"
            this.bodies[0].linear_velocity[0] = 2;
        }
    }

    make_control_panel() {
        this.key_triggered_button("Rasengan", ["e"], () => {
            if (this.rasengan_count < this.max_rasengan)
                this.rasengan = !this.rasengan;
        });
        this.new_line();
        this.key_triggered_button("Game Start!", ["p"], () => {
            this.game_start = !this.game_start;
            this.time = 60;
            this.score = 0;
            this.username = document.getElementById("input").value;
        });
        this.new_line();
        this.input_text();
    }

    update_state(dt, num_bodies = 5) {
        //super.update_state(dt);

        if (this.bodies.length === 0) {
            const model_transform = Mat4.identity();

            //going to make one main body/collider for naruto for physics
            //but going to display other parts regularly without physics
            //collider body
            let naruto_transform = model_transform.times(this.position)
                .times(Mat4.translation(0, 0, 0, 1));
            model_transform.times(Mat4.translation(0, 0, 0));

            this.bodies.push(new Body(this.shapes.cube, this.materials.collider_mat, vec3(0.5, 0.1, 1), "NARUTO")
                .emplace(naruto_transform,
                    vec3(0, 0, 0), 0));

            //going to make ground a body as well
            let ground_transform = Mat4.translation(0, -3.5, 0, 1)
                .times(Mat4.scale(500, 0.5, 500))
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
            this.bodies.push(new Body(this.shapes.cube, this.materials.ground, vec3(1, 1, 1), "GROUND")
                .emplace(ground_transform,
                    vec3(0, 0, 0), 0));


        }

        //Create Walls
        while (this.bodies.length < num_bodies) {
            let randomX = Math.random() * 100 - 50
            while (randomX < 1 && randomX > -1) {
                randomX = Math.random() * 100 - 50
            }
            //50% chance to create a moving wall
            if (Math.random() < 0.5) {
                this.bodies.push(new Body(this.shapes.cube, this.materials.wall, vec3(1, 5, 1), "HORIZ_WALL")
                    .emplace(Mat4.translation(randomX, Math.random() * 10, 0),
                        vec3(0, 0, 0), 0));
            } else {
                this.bodies.push(new Body(this.shapes.cube, this.materials.wall, vec3(1, 5, 1), "MOVING_WALL")
                    .emplace(Mat4.translation(randomX, Math.random() * 10, 0),
                        vec3(0, 1, 0), 0));
            }
        }

        if (this.rasengan) {
            this.rasengan = !this.rasengan
            this.rasengan_count += 1
            let head = this.bodies[0]
            let naruto_transform = Mat4.identity().times(head.drawn_location).times(Mat4.scale(2, 10, 1)).times(Mat4.translation(0, 6, 0, 1));
            //Shoot rasengan left or right
            if (this.dir === "right") {
                let rasengan_transform = naruto_transform
                    .times(Mat4.translation(1, -2, 0, 1));
                this.bodies.push(new Body(this.shapes.sphere, this.materials.rasengan, vec3(1, 1, 1), "RAS")
                    .emplace(rasengan_transform,
                        vec3(4, 0, 0), 0));
            } else {
                let rasengan_transform = naruto_transform
                    .times(Mat4.translation(-1, -2, 0, 1));
                this.bodies.push(new Body(this.shapes.sphere, this.materials.rasengan, vec3(1, 1, 1), "RAS")
                    .emplace(rasengan_transform,
                        vec3(-4, 0, 0), 0));
            }
        }

        const collider = this.colliders[this.collider_selection];

        // Loop through all bodies (call each "a"):
        for (let a of this.bodies) {
            // Cache the inverse of matrix of body "a" to save time.
            a.inverse = Mat4.inverse(a.drawn_location);
            //First check if rasengan out of bounds
            if (a.tag === "RAS") {
                if (a.center[0] > 50 || a.center[0] < -50) {
                    this.bodies.splice(this.bodies.indexOf(a), 1);
                    this.rasengan_count -= 1
                    continue;
                }
            }
            if (a.tag === "NARUTO" && a.grounded === false) {
                // Gravity on Earth, where 1 unit in world space = 1 meter:
                a.linear_velocity[1] += dt * -9.8;
            }
            //OUT OF BOUNDS Check for character
            if (a.tag == "NARUTO")
            {
                if (a.center[0] > 50)
                {
                    a.linear_velocity = vec3(Math.min(0, a.linear_velocity[0]), a.linear_velocity[1], 0)
                }
                else if (a.center[0] < -50) {
                    a.linear_velocity = vec3(Math.max(0, a.linear_velocity[0]), a.linear_velocity[1], 0)
                }
            }

            if (a.tag === "MOVING_WALL") {
                a.center = vec3(a.center[0], 5 + Math.sin(Math.PI / 8 * this.t) * 5, 0)
                // if (Math.floor(this.t / 10) % 2 == 0) {
                //     if (a.linear_velocity[1] > 0)
                //         a.linear_velocity[1] = -3
                //     else
                //         a.linear_velocity[1] = 1
                //
                // }
            } else if (a.tag === "HORIZ_WALL") {
                a.center = vec3(5 + Math.sin(Math.PI / 8 * this.t) * 5, a.center[1], 0)
                // if (Math.floor(this.t / 10) % 2 == 0) {
                //     if (a.linear_velocity[0] > 0)
                //         a.linear_velocity[0] = -1
                //     else
                //         a.linear_velocity[0] = 3
                //
                // }
            }
            // *** Collision process is here ***
            // Loop through all bodies again (call each "b"):
            for (let b of this.bodies) {
                // Pass the two bodies and the collision shape to check_if_colliding():
                if (!a.check_if_colliding(b, collider)) {
                    continue;
                }
                // If we get here, we collided

                //Naruto specific collision
                if (a.tag === "NARUTO") {
                    if (b.tag === "MOVING_WALL") {
                        //wall is to the right,push left
                        if (b.center[0] > a.center[0]) {
                            a.linear_velocity = vec3(-2, a.linear_velocity[1], 0);
                        } else //wall is to the left, can only move right
                            a.linear_velocity = vec3(2, a.linear_velocity[1], 0);

                    } else if (b.tag === "HORIZ_WALL") {
                        //wall is to the right, can only move left now
                        if (b.center[0] > a.center[0]) {
                            a.linear_velocity = vec3(-2, a.linear_velocity[1], 0);
                            //wall is moving left, going to push us left
                            //a.linear_velocity = vec3(Math.min(b.linear_velocity[0], a.linear_velocity[0]), a.linear_velocity[1], 0);
                        } else //wall is to the left, can only move right
                        {
                            a.linear_velocity = vec3(2, a.linear_velocity[1], 0);
                            //a.linear_velocity = vec3(Math.max(b.linear_velocity[0],a.linear_velocity[0]),a.linear_velocity[1], 0);
                        }
                    } else if (b.tag === "GROUND") {
                        //Only grounded if falling, not if already grounded
                        if (a.linear_velocity <= 0)
                            a.grounded = true;
                        a.linear_velocity = vec3(a.linear_velocity[0], Math.max(0, a.linear_velocity[1]), 0);
                        a.angular_velocity = 0;
                    }
                } else if (b.tag === "NARUTO") {
                    if (a.tag === "MOVING_WALL") {
                        if (a.center[0] > b.center[0]) {
                            b.linear_velocity = vec3(-2, b.linear_velocity[1], 0);
                            //b.linear_velocity = vec3(Math.min(0, b.linear_velocity[0]), b.linear_velocity[1], 0);
                        } else //wall is to the left, can only move right
                        {
                            b.linear_velocity = vec3(2, b.linear_velocity[1], 0);
                            //b.linear_velocity = vec3(Math.max(0,b.linear_velocity[0]),b.linear_velocity[1], 0);
                        }
                    } else if (a.tag === "HORIZ_WALL") {
                        //console.log("NARUTO HIT WALL")
                        if (a.center[0] > b.center[0]) {
                            //wall is moving left, going to push us left
                            b.linear_velocity = vec3(-2, b.linear_velocity[1], 0);
                            //b.linear_velocity = vec3(Math.min(b.linear_velocity[0], a.linear_velocity[0]), b.linear_velocity[1], 0);
                        } else //wall is to the left, can only move right
                        {
                            b.linear_velocity = vec3(2, b.linear_velocity[1], 0);
                            //b.linear_velocity = vec3(Math.max(b.linear_velocity[0],a.linear_velocity[0]),b.linear_velocity[1], 0);
                        }
                    } else if (a.tag === "GROUND") {
                        //Only grounded if falling, not if already grounded
                        if (b.linear_velocity <= 0)
                            b.grounded = true;
                        b.linear_velocity = vec3(b.linear_velocity[0], Math.max(0, b.linear_velocity[1]), 0);
                        b.angular_velocity = 0;
                    }
                }//RASENGAN COLLISIONS
                if (a.tag === "RAS") {
                    if (b.tag === "MOVING_WALL" || b.tag === "HORIZ_WALL") {
                        //destroy the wall and the rasengan
                        this.rasengan_count -= 1
                        this.bodies.splice(this.bodies.indexOf(a), 1);
                        this.bodies.splice(this.bodies.indexOf(b), 1);
                        this.score += 1;
                    }
                } else if (b.tag === "RAS") {
                    if (a.tag === "MOVING_WALL" || a.tag === "HORIZ_WALL") {
                        //destroy the wall and the rasengan
                        this.rasengan_count -= 1
                        this.bodies.splice(this.bodies.indexOf(a), 1);
                        this.bodies.splice(this.bodies.indexOf(b), 1);
                        this.score += 1;
                    }
                } else if (a.tag === "HORIZ_WALL" && b.tag === "GROUND") {
                    a.grounded = true;
                    a.linear_velocity = vec3(a.linear_velocity[0], 0, 0);
                    a.angular_velocity = 0;
                } else if (a.tag === "GROUND" && b.tag === "HORIZ_WALL") {
                    b.grounded = true;
                    b.linear_velocity = vec3(b.linear_velocity[0], 0, 0);
                    b.angular_velocity = 0;
                }

            }
        }

    }

    drawEnvironment(context, program_state) {
        const light_position = vec4(-5, 20, 0, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // Draw the skybox with a custom noise cloud shader.
        // TODO: Shader needs work--specifically it incorrectly mixes at the edge of the shape!
        this.shapes.sphere.draw(context, program_state, Mat4.scale(500, 500, 500), this.materials.sky);

        // Ground
        let ground_transform = Mat4.translation(0, -3, 0)
            .times(Mat4.scale(500, 0.2, 500))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.ground.draw(context, program_state, ground_transform, this.materials.ground);

        // Background
        let bg_transform = Mat4.translation(0, -15, -150, 1)
            .times(Mat4.scale(500, 0.35, 25));
        this.shapes.sheet2.draw(context, program_state, bg_transform, this.materials.background);
        this.shapes.sheet2.draw(context, program_state, Mat4.scale(-1, 1, 1)
            .times(Mat4.translation(0, 10, -50)).times(bg_transform), this.materials.background.override(
            {ambient: 1, color: hex_color('#aee0ec')}));

        // https://gist.github.com/blixt/f17b47c62508be59987b?permalink_comment_id=3662324#gistcomment-3662324
        let rand = (s) => _ => (2 ** 31 - 1 & (s = Math.imul(16807, s))) / 2 ** 31;
        let hash = (n) => Math.imul(n, 2654435761) >>> 0;
        let rng = (i) => rand(hash(i))() * (8 - 4) + 4;

        for (let i = 1; i < 15; i++) {
            let tree_transform = Mat4.rotation(rand(hash(i + 35))() * (Math.PI / 2 - Math.PI) + Math.PI, 0, 1, 0)
                .times(Mat4.translation(i * 10 % 100, 0.5, rand(hash(i))() * (120 - 15) + 15))
                .times(Mat4.rotation(rand(hash(i ** 2))() * (0.15 + 0.15) - 0.15, 1, 0, 1))
                .times(Mat4.rotation(rand(hash(i + 30))(), 0, 1, 0))
                .times(Mat4.scale(rng(i), rng(i) * 1.25, rng(i)));
            this.shapes.tree.draw(context, program_state, tree_transform, this.materials.moss);
        }
    }

    drawCharacter(context, program_state) {

        const model_transform = Mat4.identity();

        let naruto_transform;
        // Naruto
        if (this.bodies == null || this.bodies.length === 0) {
            //console.log("HERE")
            naruto_transform = model_transform.times(this.position)
                .times(Mat4.translation(0, 3, 5, 1));
            //console.log(this.position)
        } else {
            let head = this.bodies[0]
            naruto_transform = model_transform.times(head.drawn_location).times(Mat4.scale(2, 10, 1)).times(Mat4.translation(0, 6, 0, 1));
        }

        // Head
        this.shapes.sphere.draw(context, program_state, naruto_transform, this.materials.head);

        // Body
        let body_transform = model_transform.times(Mat4.translation(0, -2, 0))
            .times(Mat4.scale(0.5, 1, 1));
        this.shapes.cube.draw(context, program_state, naruto_transform.times(body_transform), this.materials.body);

        // Left hand
        let left_hand_transform = model_transform.times(Mat4.rotation(1, 1, 0, 0))
            .times(Mat4.translation(0, 0, 3))
            .times(Mat4.scale(0.3, 0.3, 2.5));
        this.shapes.limb.draw(context, program_state, naruto_transform.times(left_hand_transform), this.materials.limb);

        // Right hand
        let right_hand_transform = model_transform.times(Mat4.rotation(2.1, 1, 0, 0))
            .times(Mat4.translation(0, 0, 3))
            .times(Mat4.scale(0.3, 0.3, 2.5));
        this.shapes.limb.draw(context, program_state, naruto_transform.times(right_hand_transform), this.materials.limb);

        // Left leg
        let left_leg_transform = model_transform.times(Mat4.rotation(1.4, 1, 0, 0))
            .times(Mat4.translation(0, 0, 4.5))
            .times(Mat4.scale(0.3, 0.3, 3));
        this.shapes.limb.draw(context, program_state, naruto_transform.times(left_leg_transform), this.materials.limb);

        // Right leg
        let right_leg_transform = model_transform.times(Mat4.rotation(1.7, 1, 0, 0))
            .times(Mat4.translation(0, 0, 4.5))
            .times(Mat4.scale(0.3, 0.3, 3));
        this.shapes.limb.draw(context, program_state, naruto_transform.times(right_leg_transform), this.materials.limb);
    }

    drawTimer(context, program_state) {
        const dt = program_state.animation_delta_time / 1000;

        if (this.time > 0) {
            this.time -= dt;
        }
        let time = Math.round(this.time);
        let timer_transform = Mat4.identity()
            .times(Mat4.translation(22, 12, 40, 1))
            .times(Mat4.rotation(2.6, 0, 1, 0));
        this.shapes.cube.draw(context, program_state, timer_transform, this.grey);

        let cube_side = Mat4.translation(-.9, .9, 1.01);
        let scale_factor = 0.5;
        this.shapes.text.set_string(time.toString(), context.context);
        this.shapes.text.draw(context, program_state, cube_side.times(Mat4.translation(0, -1, 0, 1)).times(timer_transform)
            .times(Mat4.rotation(2.9, 0, 1, 0))
            .times(Mat4.scale(scale_factor, scale_factor, scale_factor)), this.text_image);
    }

    drawScore(context, program_state) {


        let score_transform = Mat4.identity()
            .times(Mat4.translation(22, 9, 40, 1))
            .times(Mat4.rotation(2.6, 0, 1, 0));
        this.shapes.cube.draw(context, program_state, score_transform, this.grey);

        let cube_side = Mat4.translation(-.9, .9, 1.01);
        let scale_factor = 0.5;

        let number_adjust;
        if (this.score >= 10) {
            number_adjust = 0.1;
        } else {
            number_adjust = 0.5;
        }

        this.shapes.text.set_string(this.score.toString(), context.context);
        this.shapes.text.draw(context, program_state, cube_side.times(Mat4.translation(number_adjust, -1, 0, 1)).times(score_transform)
            .times(Mat4.rotation(2.9, 0, 1, 0))
            .times(Mat4.scale(scale_factor, scale_factor, scale_factor)), this.text_image);
    }

    drawScore_board(context, program_state) {


        const dict = this.scores;
        const items = Object.keys(dict).map(
            (key) => {
                return [key, dict[key]]
            });
        items.sort(
            (first, second) => {
                return second[1] - first[1]
            }
        );

        let score_board_position = Mat4.translation(0, 0, 60);
        let score_board_transform = score_board_position.times(Mat4.scale(10, 5, 1));
        let order_transform = Mat4.translation(-1, 3, 0, 1);
        let text_transform = Mat4.translation(-1, 0, 0, 1);
        this.shapes.cube.draw(context, program_state, score_board_transform, this.grey);

        let cube_side = Mat4.translation(-.9, .9, 1.01);
        let scale_factor = 0.5;

        let top5 = 0;
        for (let key in items) {
            const string = items[key];

            this.shapes.text.set_string(string.toString(), context.context);

            this.shapes.text.draw(context, program_state, cube_side.times(order_transform).times(score_board_position).times(text_transform)
                .times(Mat4.scale(scale_factor, scale_factor, scale_factor)), this.text_image);
            order_transform = order_transform.times(Mat4.translation(0, -1, 0, 0));
            top5 += 1;

            if (top5 >= 5) {
                break;
            }
        }
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        super.display(context, program_state);
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        //const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        if (this.position[1][3] > 0) {
            this.position[1][3] -= 0.5
        }

        this.drawEnvironment(context, program_state);
        if (this.game_start) {
            this.drawCharacter(context, program_state);
            this.drawTimer(context, program_state);
            this.drawScore(context, program_state);
            if (this.time <= 0) {
                this.game_start = false;
            }
            if ((this.score > 0 && this.score > this.scores[this.username]) || !this.scores[this.username])
                this.scores[this.username] = this.score;
        } else {
            this.drawScore_board(context, program_state);
        }
    }
}

//Modifying Body class to have identifiers
export class Body {
    // **Body** can store and update the properties of a 3D body that incrementally
    // moves from its previous place due to velocities.  It conforms to the
    // approach outlined in the "Fix Your Timestep!" blog post by Glenn Fiedler.
    constructor(shape, material, size, tag) {
        Object.assign(this,
            {shape, material, size})
        this.tag = tag
    }

    // (within some margin of distance).
    static intersect_cube(p, margin = 0) {
        return p.every(value => value >= -1 - margin && value <= 1 + margin)
    }

    static intersect_sphere(p, margin = 0) {
        return p.dot(p) < 1 + margin;
    }

    // emplace(): assign the body's initial values, or overwrite them.
    emplace(location_matrix, linear_velocity, angular_velocity, spin_axis = vec3(0, 0, 0).randomized(1).normalized()) {
        this.center = location_matrix.times(vec4(0, 0, 0, 1)).to3();
        this.rotation = Mat4.translation(...this.center.times(-1)).times(location_matrix);
        this.previous = {center: this.center.copy(), rotation: this.rotation.copy()};
        // drawn_location gets replaced with an interpolated quantity:
        this.drawn_location = location_matrix;
        this.temp_matrix = Mat4.identity();
        return Object.assign(this, {linear_velocity, angular_velocity, spin_axis})
    }

    advance(time_amount) {
        // advance(): Perform an integration (the simplistic Forward Euler method) to
        // advance all the linear and angular velocities one time-step forward.
        this.previous = {center: this.center.copy(), rotation: this.rotation.copy()};
        // Apply the velocities scaled proportionally to real time (time_amount):
        // Linear velocity first, then angular:
        this.center = this.center.plus(this.linear_velocity.times(time_amount));
        this.rotation.pre_multiply(Mat4.rotation(time_amount * this.angular_velocity, ...this.spin_axis));
    }

    // The following are our various functions for testing a single point,
    // p, against some analytically-known geometric volume formula

    blend_rotation(alpha) {
        // blend_rotation(): Just naively do a linear blend of the rotations, which looks
        // ok sometimes but otherwise produces shear matrices, a wrong result.

        // TODO:  Replace this function with proper quaternion blending, and perhaps
        // store this.rotation in quaternion form instead for compactness.
        return this.rotation.map((x, i) => vec4(...this.previous.rotation[i]).mix(x, alpha));
    }

    blend_state(alpha) {
        // blend_state(): Compute the final matrix we'll draw using the previous two physical
        // locations the object occupied.  We'll interpolate between these two states as
        // described at the end of the "Fix Your Timestep!" blog post.
        this.drawn_location = Mat4.translation(...this.previous.center.mix(this.center, alpha))
            .times(this.blend_rotation(alpha))
            .times(Mat4.scale(...this.size));
    }

    check_if_colliding(b, collider) {
        // check_if_colliding(): Collision detection function.
        // DISCLAIMER:  The collision method shown below is not used by anyone; it's just very quick
        // to code.  Making every collision body an ellipsoid is kind of a hack, and looping
        // through a list of discrete sphere points to see if the ellipsoids intersect is *really* a
        // hack (there are perfectly good analytic expressions that can test if two ellipsoids
        // intersect without discretizing them into points).
        if (this === b)
            return false;
        // Nothing collides with itself.
        // Convert sphere b to the frame where a is a unit sphere:
        const T = this.inverse.times(b.drawn_location, this.temp_matrix);

        const {intersect_test, points, leeway} = collider;
        // For each vertex in that b, shift to the coordinate frame of
        // a_inv*b.  Check if in that coordinate frame it penetrates
        // the unit sphere at the origin.  Leave some leeway.
        return points.arrays.position.some(p =>
            intersect_test(T.times(p.to4(1)).to3(), leeway));
    }
}
