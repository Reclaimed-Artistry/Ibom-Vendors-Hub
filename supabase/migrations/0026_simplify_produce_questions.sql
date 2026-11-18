-- Keep the farm form focused; optional details can be supplied in the description.
update store_categories set attributes = (
 select jsonb_agg(case when item->>'key' in ('minimum_order','source_location','storage_instructions','fulfilment_notes')
   then item - 'required' else item end order by position)
 from jsonb_array_elements(attributes) with ordinality as fields(item,position)
) where slug = 'agriculture-livestock';
