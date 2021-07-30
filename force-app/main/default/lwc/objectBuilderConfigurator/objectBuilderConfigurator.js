/**
 * Valence UI plugin that allows for a custom experience when configuring the ObjectBuilder Filter.
 */

import ValenceUIConfigurator from 'c/calenceUIConfigurator';

export default class ObjectBuilderConfigurator extends ValenceUIConfigurator {

	originalResultFieldName = null; // we use this to allow the user to change the result field name then change it back without fussing at them
	resultFieldHasError = false;
	fieldList = [];

	/**
	 * Recursive function that calculates the full field path to all the fields in a schema tree and builds them into a flat list.
	 *
	 * @param children Immediate children of a given node in the tree
	 * @param ancestorPath The chain we traveled to get here
	 */
	extractFieldPaths(children, ancestorPath) {
		const returnValue = [];
		if(children) {
			Object.values(children).forEach((node) => {
				const pathToHere = ancestorPath.concat(node.field.fieldName);
				returnValue.push({'value' : pathToHere.join('::'), 'label' : pathToHere.join('.')});
				returnValue.push(...this.extractFieldPaths(node.children, pathToHere));
			});
		}
		return returnValue;
	}

	/**
	 * Don't allow the User to name their object the same as an existing source field.
	 */
	checkNameConflict() {
		const resultFieldInput = this.template.querySelector('lightning-input[data-name="resultField"]');
		if(resultFieldInput) { // field isn't there before first render
			if(resultFieldInput.value !== this.originalResultFieldName && this.fieldList.find(field => field.value === resultFieldInput.value)) {
				resultFieldInput.setCustomValidity('There is already a source field with this name. Use a name that doesn\'t already exist.');
				this.resultFieldHasError = true;
			} else {
				resultFieldInput.setCustomValidity('');
				this.resultFieldHasError = false;
			}
			resultFieldInput.reportValidity();
		}
	}

	connectedCallback() {
		if(!this.originalResultFieldName) {
			this.originalResultFieldName = this.configuration.resultName;
		}
	}

	// ------------------------------------------
	// ----- Configurator Lifecycle Methods -----
	// ------------------------------------------

	/**
	 * Set up our fieldList whenever we are given schema
	 */
	onSetSchema() {
		console.log('setSchema: ', this.schema);
		this.fieldList = this.extractFieldPaths(this.schema.Source.children, []);
		this.fieldList.sort((a, b) => a.value.localeCompare(b.value));
		console.log('fieldList:', this.fieldList);
	}

	/**
	 * Because combobox has to work with a string value and sourcePaths are arrays, we enrich each configuration record with a flattened path
	 */
	onSetConfiguration() {
		console.log('setConfiguration: ', this.configuration);
		this.configuration.fields = this.configuration.fields.map(field => Object.assign({'flattened' : field.sourcePath.join('::')}, field));
		this.checkNameConflict(); // re-run our name check since the resultField value might have just changed
		console.log('configurationAfter:', this.configuration);
	}

	/**
	 * This is called just before sending the configuration up the chain. We return a simplified version of configuration since we added stuff to it.
	 */
	tweakConfiguration() {
		return {
			'resultName' : this.configuration.resultName,
			'fields' : this.configuration.fields.map(field => {
				return {'fieldName' : field.fieldName, 'sourcePath' : field.sourcePath};
			})
		};
	}

	// -------------------------------------------
	// ----- User Manipulating Configuration -----
	// -------------------------------------------

	updateResultField(event) {
		this.configuration.resultName = event.target.value;
		this.configUpdated(); // propagate our configuration changes
	}

	addField() {
		this.configuration.fields.push({'fieldName' : '', 'sourcePath' : []});
		this.configUpdated(); // propagate our configuration changes
	}

	removeField(event) {
		this.configuration.fields.splice(event.target.value, 1);
		this.configUpdated(); // propagate our configuration changes
	}

	updateFieldName(event) {
		this.configuration.fields[event.target.dataset.index].fieldName = event.target.value;
		this.configUpdated(); // propagate our configuration changes
	}

	updateSourcePath(event) {
		this.configuration.fields[event.target.dataset.index].sourcePath = event.target.value.split('::');
		this.configUpdated(); // propagate our configuration changes
	}

	// -----------------------------------------
	// ----- Required Configurator Methods -----
	// -----------------------------------------

	getDefaultShape() {
		console.log('defaultShape called');
		return {resultName : null, fields : []};
	}

	computeValid() {
		let fieldsCheckOut = true;
		this.configuration.fields.forEach(field => {
			fieldsCheckOut = fieldsCheckOut && field.fieldName && field.sourcePath;
		});
		// valid if we've selected a unique result name, have at least one field we're pulling in, and all fields have name and path populated
		return !this.resultFieldHasError && this.configuration.resultName && this.configuration.fields.length > 0 && fieldsCheckOut;
	}
}
