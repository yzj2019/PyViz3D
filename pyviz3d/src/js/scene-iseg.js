import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from     'three/addons/loaders/OBJLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GUI } from           'three/addons/libs/lil-gui.module.min.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let num_objects_curr = 0;
let num_objects = 100;


const layers = {
	'Toggle Name': function () {
		console.log('toggle')
		camera.layers.toggle(0);
	}
}

// TODO 维护一个 scene_name, 用于选择渲染的场景, 改下面的代码对应的名称

// TODO mesh的处理，在 gridsampling 的时候需要返回 index，按index能把 mesh vertices selected 映射到 grid selected

// TODO 按钮，按下绑定 onmousemove 选择paint 与 按下同时按住 CTRL 反选 paint


// function: set color
function click_set_color(colorAttribute, index, color_new) {
	/**
	 * colorAttribute: THREE.Float32BufferAttribute
	 * index: index to change
	 * color_new: e.g. [1,0,0]
	 * **/
	// 设置新颜色
	colorAttribute.setXYZ(
		index,
		color_new[0],
		color_new[1],
		color_new[2]
	);
	colorAttribute.needsUpdate = true;
}

// function: reset color
function click_reset_color(colorAttribute, index, originColor) {
	/**
	 * originColor: structuredClone(colorAttribute.array), floatarray
	 * colorAttribute: THREE.Float32BufferAttribute
	 * index: index to change
	 * **/
	// 恢复原始颜色
	colorAttribute.setXYZ(
		index,		// coord index
		originColor[index * 3],		// r
		originColor[index * 3 + 1],	// g
		originColor[index * 3 + 2]	// b
	);
	colorAttribute.needsUpdate = true;
}


function handlePointCloudClick(event, intersection) {
	// 处理 PointCloud 点击
	const index = intersection.index;
	const object = intersection.object
	const colorAttribute = object.geometry.attributes.color;	// THREE.Float32BufferAttribute
	const positionAttribute = object.geometry.attributes.position;

	if (!('_isSelect' in object)) {
		// 创建 selected 数组
		object._isSelect = new Array(colorAttribute.array.length/3).fill(false);
		object._originColor = structuredClone(colorAttribute.array);
	}
	// 未选中则设置颜色, 已选中则恢复颜色
	if (!object._isSelect[index]) {
		object._isSelect[index] = true;
		click_set_color(colorAttribute, index, [1, 0, 0]);
	} else {
		object._isSelect[index] = false;
		click_reset_color(colorAttribute, index, object._originColor);
	}
}


function handleMeshClick(event, intersection) {
	// 处理 Mesh 点击
	const face = intersection.face;
	const faceIndex = intersection.faceIndex;
	const object = intersection.object
	const colorAttribute = object.geometry.attributes.color;	// THREE.Float32BufferAttribute
	const positionAttribute = object.geometry.attributes.position;

	if (!('_isSelect' in object)) {
		// 创建 selected 数组, shape 同 face index
		// face index, 属于 indexed mesh, 存了每个面的三个顶点的 index
		object._isSelect = new Array(object.geometry.index.array.length).fill(false);
		object._originColor = structuredClone(colorAttribute.array);
	}
	// 未选中则设置颜色, 已选中则恢复颜色
	if (!object._isSelect[faceIndex]) {
		object._isSelect[faceIndex] = true;
		click_set_color(colorAttribute, face.a, [1, 0, 0]);
		click_set_color(colorAttribute, face.b, [1, 0, 0]);
		click_set_color(colorAttribute, face.c, [1, 0, 0]);
	} else {
		object._isSelect[faceIndex] = false;
		click_reset_color(colorAttribute, face.a, object._originColor);
		click_reset_color(colorAttribute, face.b, object._originColor);
		click_reset_color(colorAttribute, face.c, object._originColor);
	}
}


function onMouseClick(event) {
	// 鼠标点击的回调函数
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

	raycaster.setFromCamera(mouse, camera);

	// Detect intersections with all visible objects in the scene
	let intersections = raycaster.intersectObjects(scene.children.filter(obj => obj.visible), true);
	// true 为迭代检测后代, filter 了 invisible 的
	console.log('Intersections:', intersections);

	// 处理 intersection
	if (intersections.length > 0) {
		intersection = intersections[0];
		console.log('Intersection:', intersection);
		const object = intersection.object

		// Handle the selected object, e.g., change color
		if (object instanceof THREE.Points) {
			handlePointCloudClick(event, intersection);
		} else if (object instanceof THREE.Mesh){
			handleMeshClick(event, intersection);
		}
	} else {
		intersection = null;
	}
	render();
}


// TODO 加一个 object 管理 gui，用于增加、减少 objcet，选择 object 增加、减少 click
// TODO 一个 forward 按钮，用于推送 click map 到后端，后端再转化为 query


function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Detect intersections with all visible objects in the scene
	let intersections = raycaster.intersectObjects(scene.children.filter(obj => obj.visible), true);
	// true 为迭代检测后代, filter 了 invisible 的
	let object = null;
	let colorAttribute = null;
	let need_render = false;
	let intersection = null;
	let prev_intersection = null;

	// function: set color
	function set_color(object, colorAttribute, index, color) {
		/**
		 * object: object._prev_hover
		 * colorAttribute: THREE.Float32BufferAttribute
		 * index: index to change, like [0, 1]
		 * color: color to change, like [[1,0,0], [0,1,0]] for index [0, 1]; or [1,0,0], will be converted to [[1,0,0], [1,0,0]]
		 * **/
		// 处理数组成二维
		if (color.length > 0) {
			if (!Array.isArray(color[0])) {
				color = index.map(() => [...color]);
			}
		}
		console.assert(index.length == color.length, "index.length must be equal to color.length");
		// 恢复旧位置原色
		if (object._prev_hover.index != null) {
			const prev_index = object._prev_hover.index
			const prev_color = object._prev_hover.color
			for (let i = 0; i < prev_index.length; i++) {
				colorAttribute.setXYZ(
					prev_index[i],		// coord index
					prev_color[i][0],	// r
					prev_color[i][1],	// g
					prev_color[i][2]	// b
				);
			}
		}
		// 记录新位置和原色
		object._prev_hover.index = index
		object._prev_hover.color = structuredClone(color)
		const prev_color = object._prev_hover.color
		for (let i = 0; i < index.length; i++) {
			prev_color[i][0] = colorAttribute.getX(index[i]);	// r
			prev_color[i][1] = colorAttribute.getY(index[i]);	// g
			prev_color[i][2] = colorAttribute.getZ(index[i]);	// b
		}
		// 设置新颜色
		for (let i = 0; i < index.length; i++) {
			colorAttribute.setXYZ(
				index[i],
				color[i][0],
				color[i][1],
				color[i][2]
			);
		}
		colorAttribute.needsUpdate = true;
	}

	// 处理 intersection
	if (intersections.length > 0) {
		prev_intersection = intersection;
		intersection = intersections[0];
		// 提高渲染效率，判断是否需要重新渲染
		object = intersection.object
		colorAttribute = object.geometry.attributes.color;	// THREE.Float32BufferAttribute
		const positionAttribute = object.geometry.attributes.position;
		if (!('_prev_hover' in object)) {
			// 创建 prev_hover 用于存储之前的位置index和颜色
			object._prev_hover = {
				index: null,
				color: null
			}
		}
		// Handle the hang overed obj, change color
		if (object instanceof THREE.Points) {
			// 处理 pointclouds
			const index = intersection.index;
			if (prev_intersection != null && prev_intersection.index == index) {
				need_render = false;
			} else {
				need_render = true;
				set_color(object, colorAttribute, [index], [1, 0, 0]);
			}
		} else if (object instanceof THREE.Mesh){
			// 处理 mesh
			const face = intersection.face;
			if (prev_intersection != null && prev_intersection.faceIndex != intersection.faceIndex) {
				need_render = false;
			} else {
				need_render = true;
				set_color(object, colorAttribute, [face.a, face.b, face.c], [1, 0, 0]);
			}
		}
	} else if (intersection != null) {
		prev_intersection = intersection;
		intersection = null;
		need_render = true;
		set_color(object, colorAttribute, [], []);
	}
	if (need_render) {
		render();
	}
}



function add_progress_bar(){
    let gProgressElement = document.createElement("div");
    const html_code = '<div class="progress">\n' +
		'<div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%" id="progress_bar"></div>\n' +
		'</div>';
    gProgressElement.innerHTML = html_code;
    gProgressElement.id = "progress_bar_id"
    gProgressElement.style.left = "20%";
    gProgressElement.style.right = "20%";
    gProgressElement.style.position = "fixed";
    gProgressElement.style.top = "50%";
    document.body.appendChild(gProgressElement);
}

function step_progress_bar(){
	num_objects_curr += 1.0
	let progress_int = parseInt(num_objects_curr / num_objects * 100.0)
	let width_string = String(progress_int)+'%';
	document.getElementById('progress_bar').style.width = width_string;
	document.getElementById('progress_bar').innerText = width_string;

	if (progress_int==100) {
		document.getElementById('progress_bar_id').innerHTML = "";
	}
}


function set_camera_properties(properties){
	camera.setFocalLength(properties['focal_length']);
	console.log(camera.getFocalLength);
	camera.up.set(properties['up'][0],
		          properties['up'][1],
				  properties['up'][2]);
	camera.position.set(properties['position'][0],
						properties['position'][1],
						properties['position'][2]);
	update_controls();
	controls.update();
	controls.target = new THREE.Vector3(properties['look_at'][0],
	 	                                properties['look_at'][1],
	 						    		properties['look_at'][2]);
	camera.updateProjectionMatrix();
	controls.update();
}


function get_points(properties){
	// Add points
	// https://github.com/mrdoob/three.js/blob/master/examples/webgl_buffergeometry_points.html
	let positions = [];
	let normals = [];
	let num_points = properties['num_points'];
	let geometry = new THREE.BufferGeometry();
	let binary_filename = properties['binary_filename'];
	let binary_filepath = 'data/'+binary_filename

	fetch(binary_filepath)
	    .then(response => response.arrayBuffer())
		.then(buffer => {
			positions = new Float32Array(buffer, 0, 3 * num_points);
			normals = new Float32Array(buffer, (3 * num_points) * 4, 3 * num_points);
		    let colors_uint8 = new Uint8Array(buffer, (3 * num_points) * 8, 3 * num_points);
		    let colors_float32 = Float32Array.from(colors_uint8);
		    for(let i=0; i<colors_float32.length; i++) {
			    colors_float32[i] /= 255.0;
			}
		    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
			geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
			geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors_float32, 3));
		})
		.then(step_progress_bar)
        .then(render);

	 let uniforms = {
        pointSize: { value: properties['point_size'] },
		alpha: {value: properties['alpha']},
		shading_type: {value: properties['shading_type']},
     };

	 let material = new THREE.ShaderMaterial( {
		uniforms:       uniforms,
        vertexShader:   document.getElementById( 'vertexshader' ).textContent,
        fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
        transparent:    true});

	let points = new THREE.Points(geometry, material);
	return points
}


function get_mesh(properties){
	var container = new THREE.Object3D();
	function loadModel(geometry) {
		let object;
		let r = properties['color'][0]
		let g = properties['color'][1]
		let b = properties['color'][2]
		let colorString = "rgb("+r+","+g+", "+b+")"
		if (geometry.isObject3D) {  // obj
			object = geometry;
			object.traverse(
				function(child) {
					if (child.isMesh) {
						child.material.color.set(new THREE.Color(colorString));
					}
				});
		} else {  // ply
			const materialShader = (geometry.hasAttribute('normal')) ? THREE.MeshPhongMaterial : THREE.MeshBasicMaterial
			const material = new materialShader({vertexColors: geometry.hasAttribute('color')})
			if (!geometry.hasAttribute){
				material.color.set(new THREE.Color(colorString));
			}
			object = new THREE.Mesh(geometry, material);
		}

		object.scale.set(properties['scale'][0], properties['scale'][1], properties['scale'][2])
		object.setRotationFromQuaternion(new THREE.Quaternion(properties['rotation'][0], properties['rotation'][1], properties['rotation'][2], properties['rotation'][3]))
		object.position.set(properties['translation'][0], properties['translation'][1], properties['translation'][2])
		container.add(object)
		step_progress_bar();
		render();
	}
	const filename_extension = properties['filename'].split('.').pop()
	console.log(filename_extension)

	let loader;
	if (filename_extension === 'ply'){
		loader = new PLYLoader();
	} else if (filename_extension === 'obj'){
		loader = new OBJLoader();
	} else {
		console.log( 'Unknown mesh extension: ' + filename_extension);
	}
	loader.load('data/'+properties['filename'], loadModel,
				function (xhr){ // called when loading is in progresses
					console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
				},
				function (error){ // called when loading has errors
					console.error( 'An error happened: ', error);
				});
	return container
}


function init_gui(objects) {
	// 右上角的控件
	let menuMap = new Map();
	for (const [name, value] of Object.entries(objects)){
		let splits = name.split(';');
		if (splits.length > 1) {
			let folder_name = splits[0];
			if (!menuMap.has(folder_name)) {
				menuMap.set(folder_name, gui.addFolder(folder_name));
			}
			let fol = menuMap.get(folder_name);
			fol.add(value, 'visible').name(splits[1]).onChange(render);
			fol.open();
		} else {
			if (value.name.localeCompare('labels') != 0) {
				gui.add(value, 'visible').name(name).onChange(render);
			}
		}
	}
}


function render() {
    renderer.render(scene, camera);
	// labelRenderer.render(scene, camera);
}


function init(){
	scene.background = new THREE.Color(0xffffff);
	renderer.setSize(window.innerWidth, window.innerHeight);
	// labelRenderer.setSize(window.innerWidth, window.innerHeight);

	let hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
	hemiLight.position.set(0, 20, 0);
	//scene.add(hemiLight);

	let dirLight = new THREE.DirectionalLight( 0xffffff );
	dirLight.position.set(-10, 10, - 10);
	dirLight.castShadow = true;
	dirLight.shadow.camera.top = 2;
	dirLight.shadow.camera.bottom = - 2;
	dirLight.shadow.camera.left = - 2;
	dirLight.shadow.camera.right = 2;
	dirLight.shadow.camera.near = 0.1;
	dirLight.shadow.camera.far = 40;
	//scene.add(dirLight);

	let intensity = 0.5;
	let color = 0xffffff;
	const spotLight1 = new THREE.SpotLight(color, intensity);
	spotLight1.position.set(100, 1000, 0);
	scene.add(spotLight1);
	const spotLight2 = new THREE.SpotLight(color, intensity/3.0);
	spotLight2.position.set(100, -1000, 0);
	scene.add(spotLight2);
	const spotLight3 = new THREE.SpotLight(color, intensity);
	spotLight3.position.set(0, 100, 1000);
	scene.add(spotLight3);
	const spotLight4 = new THREE.SpotLight(color, intensity/3.0);
	spotLight4.position.set(0, 100, -1000);
	scene.add(spotLight4);
	const spotLight5 = new THREE.SpotLight(color, intensity);
	spotLight5.position.set(1000, 0, 100);
	scene.add(spotLight5);
	const spotLight6 = new THREE.SpotLight(color, intensity/3.0);
	spotLight6.position.set(-1000, 0, 100);
	scene.add(spotLight6);

	// 鼠标点击相关
	raycaster = new THREE.Raycaster();
	// 需要合理设置 threshold, 用于限制 'distanceToRay', 使得不会将没相交的判定相交
	// 因为 intersection 是按照 'distance' (to camera) 去排序的
	raycaster.params.Points.threshold = 0.01;
	intersection = null;
	mouse = new THREE.Vector2();
	// 创建用于可视化射线的几何体和材质
	// const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
	// const points = [
	//     new THREE.Vector3(0, 0, 0),
	//     new THREE.Vector3(0, 0, 0),
	// ];
	// const geometry = new THREE.BufferGeometry().setFromPoints(points);
	// line = new THREE.Line(geometry, material);
	// scene.add(line);
}


function create_threejs_objects(properties){

	num_objects_curr = 0.0;
	num_objects = parseFloat(Object.entries(properties).length);

	for (const [object_name, object_properties] of Object.entries(properties)) {
		if (String(object_properties['type']).localeCompare('camera') == 0){
			set_camera_properties(object_properties);
			render();
    		step_progress_bar();
    		continue;
		}
		if (String(object_properties['type']).localeCompare('points') == 0){
			threejs_objects[object_name] = get_points(object_properties);
    		render();
		}
		if (String(object_properties['type']).localeCompare('mesh') == 0){
			threejs_objects[object_name] = get_mesh(object_properties);
			render();
		}
		
		threejs_objects[object_name].visible = object_properties['visible'];
		threejs_objects[object_name].frustumCulled = false;
	}
	
	// Add axis helper
	threejs_objects['Axis'] = new THREE.AxesHelper(1);

	render();
}


function add_threejs_objects_to_scene(threejs_objects){
	for (const [key, value] of Object.entries(threejs_objects)) {
		scene.add(value);
	}
}


function onWindowResize(){
    const innerWidth = window.innerWidth
    const innerHeight = window.innerHeight;
    renderer.setSize(innerWidth, innerHeight);
    // labelRenderer.setSize(innerWidth, innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    render();
}


function update_controls(){
	controls = new OrbitControls(camera, renderer.domElement);
	// controls = new OrbitControls(camera, labelRenderer.domElement);
	controls.addEventListener("change", render);
	controls.enableKeys = true;
	controls.enablePan = true; // enable dragging
}



const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('render_container').appendChild(renderer.domElement)

// let labelRenderer = new CSS2DRenderer();
// labelRenderer.setSize(window.innerWidth, window.innerHeight);
// labelRenderer.domElement.style.position = 'absolute';
// labelRenderer.domElement.style.top = '0px';
// document.getElementById('render_container').appendChild(labelRenderer.domElement)

window.addEventListener('resize', onWindowResize, false);
// Add single click event listener
renderer.domElement.addEventListener('click', onMouseClick, false);
// Hang over
// renderer.domElement.addEventListener('mousemove', onMouseMove, false);

var camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.01, 1000);
var controls = '';
const gui = new GUI({autoPlace: true, width: 120});

// dict containing all objects of the scene
let threejs_objects = {};
// 声明鼠标点击相关变量, 在 init() 中初始化
let raycaster, intersection, mouse;
// 选择 scene
let scene_params = {
	selected_scene: null
};

init();



// Load nodes.json and perform one after the other the following commands:
fetch('nodes.json')
	.then(response => {add_progress_bar(); return response;})
    .then(response => {return response.json();})
    // .then(json_response => {console.log(json_response); return json_response})
    .then(json_response => create_threejs_objects(json_response))
    .then(() => add_threejs_objects_to_scene(threejs_objects))
    .then(() => init_gui(threejs_objects))
	.then(() => console.log('Done'))
	.then(render);