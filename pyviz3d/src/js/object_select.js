import * as THREE from 'three';
import 'vanilla-colorful';
import { computePosition, autoPlacement } from '@floating-ui/dom';



// 调色盘
class Pickr_vanilla {
	constructor(options = {}) {
		// options = {el: domElement}
		// 创建 pickr 元素
		this.pickrElement = document.createElement("hex-color-picker");
		this.pickrElement.color = options.color ?? "#3c3b3d";
		document.body.appendChild(this.pickrElement);
		// 将 pickr 绑定到 el
		this.bundleButton(options.el);
	}

	// 将 pickr 绑定到 buttonElement
	bundleButton(buttonElement) {
		this.buttonElement = buttonElement;

		// 点击 buttonElement 显示/隐藏 pickrElement
		this.buttonElement.addEventListener('click', (event) => {
			this.setPickerPosition();
			this.pickrElement.classList.add('open');
		});

		// 点击其他地方时隐藏 pickrElement
		document.addEventListener('click', (event) => {
			// 检查点击是否发生在 pickrElement 和自己的按钮之外
			// 同时防止在按自己按钮时，向上传播的事件自动删除了 open
			if (!this.pickrElement.contains(event.target) && event.target !== this.buttonElement) {
				this.pickrElement.classList.remove('open');
			}
		});
	}

	// 设定 pickr 相对 button 的位置
	setPickerPosition() {
		const button = this.buttonElement;
		const picker = this.pickrElement;
		// 计算并设置 picker 的位置
		computePosition(button, picker, {
			placement: 'left',
			middleware: [autoPlacement()],
		}).then(({ x, y }) => {
			Object.assign(picker.style, {
				left: `${x}px`,
				top: `${y}px`,
				position: 'fixed',
			});
		});
	}

	// 绑定颜色改变的回调函数
	onColorChanged(func) {
		// func 接受 hex string like "#42445a"
		this.pickrElement.addEventListener('color-changed', (event) => {
			// get updated color value
			const newColor = event.detail.value;
			func(newColor); // 执行回调函数
		});
		return this;
	}

	// 销毁 pickrElement
	destroy() {
		this.pickrElement.remove();
	}
}



// 单个 object 的卡片
class Card {
	constructor(options = {}) {
		// options = {color: {background: hex, text: hex}, text: str}
		// 创建 card 元素
		this.cardElement = document.createElement("div");
		this.cardElement.className = "card";
		this.setColor(options.color);

		// 创建 multi-button 容器
		this.buttons = {};
		const multiButton = document.createElement("div");
		multiButton.className = "multi-button";

		// 添加 multi-button 到 card
		this.cardElement.appendChild(multiButton);
		// 存储 element
		this.buttons.multiButtonElement = multiButton;

		// 创建按钮
		const button1 = document.createElement("button");
		let icon = document.createElement("i");
		icon.className = "fas fa-palette";
		icon.style.pointerEvents = "none"; // 添加此行以避免图标阻挡按钮的点击事件
		button1.appendChild(icon);
		multiButton.appendChild(button1);
		this.buttons.palette_button = button1;

		const button2 = document.createElement("button");
		icon = document.createElement("i");
		icon.className = "fas fa-times";
		icon.style.pointerEvents = "none"; // 添加此行以避免图标阻挡按钮的点击事件
		button2.appendChild(icon);
		multiButton.appendChild(button2);
		this.buttons.delete_button = button2;

		// 创建 card-text 元素
		this.textElement = document.createElement("p");
		this.textElement.className = "card-text";
		this.setText(options.text);
		this.cardElement.appendChild(this.textElement);
	}


	// 将 card 添加到指定的容器
	addTo(container) {
		container.appendChild(this.cardElement);
	}

	setColor(color = {}) {
		this.cardElement.style.setProperty("--background", color.background || "#3c3b3d");
		this.cardElement.style.setProperty("--text", color.textColor || "white");
	}

	setText(text) {
		this.textElement.textContent = text || "object";
	}

	// 绑定按钮的回调函数
	setButtonFunc(funcs = {}) {
		if (funcs.palette) {
			this.buttons.palette_button.addEventListener("click", funcs.palette);
		}
		if (funcs.delete) {
			this.buttons.delete_button.addEventListener("click", funcs.delete);
		}
	}

	destroy() {
		this.cardElement.remove();
	}
}






// 待分割目标
class SegObjects {
	// 定义静态属性 colorPalette
	static colorPalette = [
		"#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#33FFF5",
  		"#FFC300", "#FF5733", "#C70039", "#900C3F", "#581845",
  		"#DAF7A6", "#FFC300", "#FF5733", "#C70039", "#900C3F",
  		"#581845", "#900C3F", "#C70039", "#FF5733", "#FFC300",
  		"#28B463", "#8E44AD", "#F39C12", "#5DADE2", "#EC7063",
  		"#52BE80", "#AF7AC5", "#F4D03F", "#5499C7", "#EC7063",
  		"#85C1E9", "#FF33A6", "#3498DB", "#9B59B6", "#2980B9",
  		"#D35400", "#1ABC9C", "#2ECC71", "#E67E22", "#E74C3C"
	];

	constructor(options = {}) {
		// options = {container: domElement}
		this.obj_name_cnt = 0;		// 避免命名重复
		this.objectDict = {}; // 存放 objects 相关数据
		this.selected_obj = null;		// 选中的 obj name
		this.scene = options.scene;		// THREE.Scene
		this.render_func = options.render_func;	// renderer.render(scene, camera)
		this.sem_names = options.sem_names ?? ["0"]; // 语义类别的名称
		this.set_attribute(options);
	}

	// 异步设置属性，如果都有值则执行界面初始化
	set_attribute(options = {}) {
		this.container = options.container ?? (this.container ?? null);		// 父对象
		this.geometry = options.geometry ?? (this.geometry ?? null);	// 场景的几何体，用于复用 attributes
		if (this.container != null && this.geometry != null) {
			this.init_ui();
		}
	}

	// 界面初始化
	init_ui() {
		// 1. 创建一个控制容器
		this.controlElement = document.createElement("div");
		this.container.appendChild(this.controlElement);

		// 创建按钮 add object
		const button = document.createElement("button");
		let icon = document.createElement("i");
		icon.className = "fas fa-plus";
		icon.style.pointerEvents = "none"; // 添加此行以避免图标阻挡按钮的点击事件
		button.appendChild(icon);
		button.addEventListener("click", () => this.addObject()); 	// 使用箭头函数
		this.controlElement.appendChild(button);
		this.add_button = button;

		// 创建 checkbox 控制所有对象的 visible 属性
		this.p_checkbox = document.createElement("input");
		this.p_checkbox.type = "checkbox";
		this.p_checkbox.checked = true; // 默认所有对象是可见的
		this.controlElement.appendChild(this.p_checkbox);

		// 创建标签来描述 checkbox
		const label = document.createElement("label");
		label.innerText = "p";
		this.controlElement.appendChild(label);

		// 在 constructor 里定义一个内联函数来切换所有对象的可见性
		this.p_checkbox.addEventListener("change", () => {
			// 遍历 objectDict 中的每个对象，并设置其 visible 属性
			Object.keys(this.objectDict).forEach((key) => {
				this.objectDict[key].object.visible = this.p_checkbox.checked;
			});
			this.render_func();		// 重新渲染
		});

		// 2. 创建一个多卡片容器
		this.multiCardElement = document.createElement("div");
		this.container.appendChild(this.multiCardElement);
		// TODO 加一个内部的滚动条，适应instance太多的情况
		// TODO 每个 object 的mesh，也可以类似稀疏矩阵那样只存储index
			// TODO 进一步，用一个query去代表一个它可以query出来的mask，这样能减少显存！！！！！
		// TODO 如何处理 positive prompt、negative prompt、result 之间的颜色关系？
	}


	// 添加一个新目标
	addObject(options = {}) {
		const idx = this.obj_name_cnt.toString();
		this.objectDict[idx] = {};
		this.obj_name_cnt += 1; // 更新作为 dict key 的 cnt

		// 默认颜色
		const color = options.color ??
			SegObjects.colorPalette[this.obj_name_cnt % SegObjects.colorPalette.length];
		this.objectDict[idx].color = color;

		// 1. 创建 mesh 几何体 object3D
		// TODO 有问题，[.WebGL-0000563C04299400] GL_INVALID_ENUM: Invalid enum provided.
		// 定义 mesh 的几何
		const geometry = new THREE.BufferGeometry();
		['position', 'normal'].forEach(attr => {
			if (this.geometry.hasAttribute(attr)) {
				geometry.setAttribute(attr, this.geometry.getAttribute(attr));
			}
		});
		geometry.setIndex(new THREE.Uint16BufferAttribute([], 1)); // 确保索引有效

		// 创建可能带 normal 的材质
		const materialShader = (geometry.hasAttribute('normal')) ?
			THREE.MeshPhongMaterial : THREE.MeshBasicMaterial;
		const material = new materialShader({
			color: new THREE.Color(color), // 确保使用 THREE.Color
			vertexColors: false // 渲染时禁用顶点颜色
		});

		// 创建几何体 object3D
		const obj = new THREE.Mesh(geometry, material);
		console.log("add obj geometry", geometry);
		console.log("add obj material", material);
		this.objectDict[idx].object = obj;
		this.scene.add(obj);
		this.render_func();

		// 2. 定义卡片
		const card = new Card({
			color: {
				background: color,
			},
			text: `obj_${this.obj_name_cnt}`
		});
		this.objectDict[idx].card = card;
		card.addTo(this.multiCardElement);
		// 定义调色盘并绑定回调函数
		const pickr = new Pickr_vanilla({
			el: card.buttons.palette_button,
			color: color,
		}).onColorChanged(
			(hex) => {
				card.setColor({ background: hex });
				this.objectDict[idx].color = hex;
				this.objectDict[idx].object.material.color.set(new THREE.Color(hex)); // 确保使用 THREE.Color
				this.render_func();
			}
		);
		// 绑定删除按钮的回调函数
		card.setButtonFunc({
			delete: () => {
				pickr.destroy();
				card.destroy();
				this.scene.remove(this.objectDict[idx].object);		//从场景中移除
				this.objectDict[idx].object.geometry.dispose(); 	// 释放几何体内存
    			this.objectDict[idx].object.material.dispose(); 	// 释放材质内存
				delete this.objectDict[idx];
			},
		});
		// 添加到 scrolled content 里

	}


	// 选择目标
	selectObject(name) {
		
	}


	// 左键加，右键抹除
	modifyObject(options = {}) {
		// ctrl for pos prompt，alt for neg prompt，shift for result
		// options.op in ['add', 'del'];
		// options.type in ['pos', 'neg'];
		// 输入的 mask prompt 为 result || man made pos part - neg part
		// 输入的 point prompt 为 man made part mask 里采样
		const op = options.op ?? "add";
		const type = options.type ?? "pos";
	}

	// 使用 getter，使其像属性一样访问
	get length() {
		return Object.keys(this.objectDict).length;
	}
}



export {
	Card,
	SegObjects
}