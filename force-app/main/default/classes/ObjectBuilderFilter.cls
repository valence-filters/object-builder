/**
 * Allows an advanced User to design complex shapes that draw from the source schema of a record and
 * are composed into a single value that can be mapped and worked with normally in Valence.
 */
global with sharing class ObjectBuilderFilter implements valence.SchemaAwareTransformationFilter, valence.ConfigurablePerLinkFilter {

	private List<Configuration> configs = new List<Configuration>();

	public String getFilterConfigurationLightningComponent() {
		return 'c:objectBuilderConfigurator';
	}

	public String getFilterConfigurationStructure() {
		return null;
	}

	public String explainFilterConfiguration(String configurationData) {

		try {
			Configuration config = buildConfiguration(configurationData);

			String message = 'A source field called <strong>{0}</strong> will be added to each record that is actually a sub-object built as follows:<ul>{1}</ul>';

			List<String> entries = new List<String>();

			for(ConfigField configField : config.fields) {
				entries.add(String.format('<li><strong>{0}</strong> (Value comes from <strong>{1}</strong>)</li>', new List<Object>{
					configField.fieldName,
					String.join(configField.sourcePath, '.')
				}));
			}

			return String.format(message, new List<Object>{
				config.resultName,
				String.join(entries, '')
			});
		}
		catch(Exception e) {
			return '<p class="slds-theme_error">The configuration for this Filter is malformed.</p>';
		}
	}

	public void setFilterConfigurations(valence.LinkContext context, List<String> configurationData) {
		configs.clear();
		for(String rawConfig : configurationData) {
			if(String.isNotBlank(rawConfig)) {
				configs.add(buildConfiguration(rawConfig));
			}
		}
	}

	public Boolean validFor(valence.LinkContext context) {
		return true;
	}

	public void process(valence.LinkContext context, List<valence.RecordInFlight> records) {

		for(valence.RecordInFlight record : records) {
			for(Configuration config : configs) {
				// build up our sub-object from various fields
				Map<String, Object> props = new Map<String, Object>();
				for(ConfigField field : config.fields) {
					props.put(field.fieldName, record.getOriginalProperty(valence.FieldPath.buildPath(field.sourcePath)));
				}
				// add the sub-object assembly to the record's source properties
				record.setOriginalProperty(valence.FieldPath.buildPath(config.resultName), props);
			}
		}
	}

	public valence.FilterSchema describeSchema(valence.LinkContext context) {
		valence.FilterSchema schema = new valence.FilterSchema();

		for(Configuration config : configs) {
			valence.Field.FieldBuilder sourceField = valence.Field.create(config.resultName)
				.withDescription(String.format('An injected field composed of {0} other field values, as defined in an ObjectBuilder configuration.', new List<Object>{config.fields.size()}))
				.withType('Object');
			for(ConfigField configField : config.fields) {
				sourceField.addChild(
					valence.Field.create(configField.fieldName).withDescription('Comes from <strong>' + String.join(configField.sourcePath, '.') + '</strong>').build()
				);
				// let Valence know we read the source field
				schema.addTouch(valence.FilterSchema.buildSourceTouch('READ').onField(configField.sourcePath));
				// and write to the nested property name
				schema.addTouch(valence.FilterSchema.buildSourceTouch('WRITE').onField(new List<String>{config.resultName, configField.fieldName}));
			}
			schema.createsSourceField(sourceField.build());
		}
		return schema;
	}

	private Configuration buildConfiguration(String jsonData) {
		return (Configuration)JSON.deserialize(jsonData, Configuration.class);
	}

	/**
	 * Defines our expectations for what a configuration of this filter looks like.
	 *
	 * The point of the Filter is to build up a single source field that is actually a composition of multiple other source fields. We represent
	 * the composition with field paths and the name we want to give that value in our new object.
	 */
	private class Configuration {

		// name of newly-created field that will be added to the source properties of the record
		private String resultName;

		// the fields that will be composed into a single object
		private List<ConfigField> fields;
	}

	private class ConfigField {

		private String fieldName;
		private List<String> sourcePath;
	}
}
