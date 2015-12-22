/// <reference path="../Utils.ts" />

namespace MarkdownIME.Renderer {
	
	export class BlockRendererContainer {
		name: string;
		
		/** 
		 * the feature mark HTML, which will be removed.
		 * do not forget `^` when writing RegExp
		 * @example ^\s*\d+\.\s+ for ordered list.
		 * @example ^(\>|&gt;)\s* for blockquote
		 */
		featureMark: RegExp;
		
		/**
		 * the new nodeName of children. Use `null` to keep original nodeName when elevate a node.
		 * @example "LI" for "ol > li"
		 */
		childNodeName: string = null;
		
		/**
		 * the new nodeName of parent. Use `null` to prevent creating one.
		 * @example "OL" for "ol > li"
		 */
		parentNodeName: string = null;
		
		/**
		 * tell if user can type inside. this helps when creating strange things like <hr>
		 */
		isTypable: boolean = true;
		
		/**
		 * if is true, the text that matches featureMark will be deleted.
		 */
		removeFeatureMark: boolean = true;
		
		/** changing its name, moving it into proper container. return null if failed. */
		Elevate (node: Element) : {parent:Element, child:Element} {
			if (!this.prepareElevate(node)) return null;
			
			var child: Element;
			var parent: Element;
			
			if (!this.childNodeName) {
				child = node;
			} else {
				//create a new tag named with childNodeName
				child = node.ownerDocument.createElement(this.childNodeName);
				while (node.firstChild) {child.appendChild(node.firstChild)}
				node.parentNode.insertBefore(child, node);
				node.parentElement.removeChild(node);
			}
			
			if (!this.parentNodeName) {
				//do nothing. need no parent.
				parent = null;
			} else {
				if (child.previousElementSibling && child.previousElementSibling.nodeName == this.parentNodeName) {
					//this child is just next to the parent.
					parent = child.previousElementSibling;
					parent.appendChild(child);
				} else {
					//create parent.
					parent = child.ownerDocument.createElement(this.parentNodeName);
					Utils.wrap(parent, child);
				}
			}
			
			return {child: child, parent: parent};
		}
		
		/** 
		 * check if one node is elevatable and remove the feature mark.
		 * do NOT use this func outsides Elevate()
		 */
		prepareElevate(node: Element) : string[] {
			if (!node) return null;
			
			var matchResult = this.featureMark.exec(node.textContent);
			if (!matchResult) return null;
		
			if (this.removeFeatureMark) {
				let n = <HTMLElement> node;
				n.innerHTML = n.innerHTML.replace(/&nbsp;/g,String.fromCharCode(160)).replace(this.featureMark, '');
			}
			
			return matchResult;
		}
	}
	
	export namespace BlockRendererContainers {
		export class UL extends BlockRendererContainer {
			constructor() {
				super();
				this.name = "unordered list";
				this.featureMark = /^\s*[\*\+\-]\s+/;
				this.childNodeName = "LI";
				this.parentNodeName = "UL";
			}
		}
		
		export class OL extends BlockRendererContainer {
			constructor() {
				super();
				this.name = "ordered list";
				this.featureMark = /^\s*\d+\.\s+/;
				this.childNodeName = "LI";
				this.parentNodeName = "OL";
			}
		}
		
		export class BLOCKQUOTE extends BlockRendererContainer {
			constructor() {
				super();
				this.name = "blockquote";
				this.featureMark = /^(\>|&gt;)\s*/;
				this.parentNodeName = "BLOCKQUOTE";
			}
		}
		
		/** assuming a <hr> is just another block container and things go easier */
		export class HR extends BlockRendererContainer {
			constructor() {
				super();
				this.isTypable = false;
				this.name = "hr";
				this.featureMark = /^\s*([\-\=\*])(\s*\1){2,}\s*$/;
			}
			
			Elevate (node: Element) : {parent:Element, child:Element} {
				if (!this.prepareElevate(node)) return null;
				
				var child = node.ownerDocument.createElement("hr");
				node.parentElement.insertBefore(child, node);
				node.parentElement.removeChild(node);
				
				return {parent: null, child: child};
			}
		}
		
		export class HeaderText extends BlockRendererContainer {
			constructor() {
				super();
				this.name = "header text";
				this.featureMark = /^(#+)\s+/;
			}
			
			Elevate (node: Element) : {parent:Element, child:Element} {
				var match = this.prepareElevate(node);
				if (!match) return null;
				
				//create a new tag named with childNodeName
				var child = node.ownerDocument.createElement("H" + match[1].length);
				while (node.firstChild) {child.appendChild(node.firstChild)}
				node.parentNode.insertBefore(child, node);
				node.parentElement.removeChild(node);
				
				return {parent: null, child: child};
			}
		}
	}
	
	/**
	 * In fact the BlockRenderer is not a renderer; it can elevate / degrade a node, changing its name, moving it from one container to another.
	 */
	export class BlockRenderer {
		
		containers : BlockRendererContainer[] = [];
		
		/** Elevate a node. Make sure the node is a block node. */
		Elevate (node : Element) : {containerType: BlockRendererContainer, parent:Element, child:Element} {
			for (var i = 0; i< this.containers.length; i++) {
				let container = this.containers[i];
				var rtn : any = container.Elevate(node);
				if (rtn) {
					rtn.containerType = container;
					return rtn;
				}
			}
			return null;
		}
		
		/** 
		 * Get suggested nodeName of a new line inside a container.
		 * @return null if no suggestion.
		 */
		GetSuggestedNodeName ( container : Element ) : string {
			for (var i = 0; i< this.containers.length; i++) {
				let cc = this.containers[i];
				if (cc.parentNodeName == container.nodeName) 
					return cc.childNodeName;
			}
			return null;
		}
		
		static markdownContainers : BlockRendererContainer[] = [
			new BlockRendererContainers.BLOCKQUOTE(),
			new BlockRendererContainers.HeaderText(),
			new BlockRendererContainers.HR(),
			new BlockRendererContainers.OL(),
			new BlockRendererContainers.UL()
		];
		
		/**
		 * (Factory Function) Create a Markdown BlockRenderer
		 */
		public static makeMarkdownRenderer() : BlockRenderer {
			var rtn : BlockRenderer = new BlockRenderer();
			rtn.containers = this.markdownContainers.concat(rtn.containers);
			return rtn;
		}
	}
}