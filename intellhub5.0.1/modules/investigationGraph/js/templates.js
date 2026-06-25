export const BUILT_IN_TEMPLATES = {
    'person': {
        name: "Person",
        fields: [
            { id: 'name', label: 'Full Name', type: 'text', isTitle: true },
            { id: 'aka', label: 'Also Known As (Alias)', type: 'text' },
            { id: 'dob', label: 'Date of Birth', type: 'date' },
            { id: 'nationality', label: 'Nationality', type: 'text' },
            { id: 'notes', label: 'Notes', type: 'textarea' }
        ]
    },
    'phone': {
        name: "Phone Number",
        fields: [
            { id: 'number', label: 'Phone Number', type: 'text', isTitle: true },
            { id: 'owner', label: 'Registered Owner', type: 'text' },
            { id: 'type', label: 'Type (e.g., Mobile, Landline)', type: 'text' },
            { id: 'country', label: 'Country', type: 'text' },
            { id: 'notes', label: 'Notes', type: 'textarea' }
        ]
    },
    'email': {
        name: "Email",
        fields: [
            { id: 'address', label: 'Email Address', type: 'text', isTitle: true },
            { id: 'owner', label: 'Associated Name/Owner', type: 'text' },
            { id: 'breaches', label: 'Found in Breaches', type: 'textarea' },
            { id: 'notes', label: 'Notes', type: 'textarea' }
        ]
    },
    'address': {
        name: "Address",
        fields: [
            { id: 'full_address', label: 'Full Address', type: 'text', isTitle: true },
            { id: 'city', label: 'City', type: 'text' },
            { id: 'country', label: 'Country', type: 'text' },
            { id: 'notes', label: 'Notes (e.g., floor, apartment)', type: 'textarea' }
        ]
    },
    'company': {
        name: "Company",
        fields: [
            { id: 'company_name', label: 'Company Name', type: 'text', isTitle: true },
            { id: 'registration_id', label: 'Registration ID', type: 'text' },
            { id: 'address', label: 'Headquarters Address', type: 'text' },
            { id: 'website', label: 'Website', type: 'url' },
            { id: 'notes', label: 'Notes', type: 'textarea' }
        ]
    },
    'vehicle': {
        name: "Vehicle",
        fields: [
            { id: 'license_plate', label: 'License Plate', type: 'text', isTitle: true },
            { id: 'make', label: 'Make', type: 'text' },
            { id: 'model', label: 'Model', type: 'text' },
            { id: 'color', label: 'Color', type: 'text' },
            { id: 'vin', label: 'VIN', type: 'text' },
            { id: 'notes', label: 'Notes', type: 'textarea' }
        ]
    },
    'website': {
        name: "Website",
        fields: [
            { id: 'url', label: 'URL', type: 'url', isTitle: true },
            { id: 'ip_address', label: 'IP Address', type: 'text' },
            { id: 'registrant', label: 'Registrant/Owner', type: 'text' },
            { id: 'hosting_provider', label: 'Hosting Provider', type: 'text' },
            { id: 'notes', label: 'Notes', type: 'textarea' }
        ]
    },
    'social': {
        name: "Social Network",
        fields: [
            { id: 'username', label: 'Username', type: 'text', isTitle: true },
            { id: 'platform', label: 'Platform (e.g., Twitter, Instagram)', type: 'text' },
            { id: 'profile_url', label: 'Profile URL', type: 'url' },
            { id: 'full_name', label: 'Full Name on Profile', type: 'text' },
            { id: 'notes', label: 'Notes', type: 'textarea' }
        ]
    },
    'document': {
        name: "Document",
        fields: [
            { id: 'doc_title', label: 'Document Title', type: 'text', isTitle: true },
            { id: 'source_url', label: 'Source URL', type: 'url' },
            { id: 'author', label: 'Author', type: 'text' },
            { id: 'summary', label: 'Summary', type: 'textarea' }
        ]
    },
    'location': {
        name: "Location",
        fields: [
            { id: 'location_name', label: 'Location Name', type: 'text', isTitle: true },
            { id: 'coordinates', label: 'Coordinates (Lat, Lon)', type: 'text' },
            { id: 'address', label: 'Address', type: 'text' },
            { id: 'description', label: 'Description', type: 'textarea' }
        ]
    },
    'event': {
        name: "Event",
        fields: [
            { id: 'event_name', label: 'Event Name', type: 'text', isTitle: true },
            { id: 'date_time', label: 'Date & Time', type: 'text' },
            { id: 'location', label: 'Location', type: 'text' },
            { id: 'summary', label: 'Summary', type: 'textarea' }
        ]
    },
    'other': {
        name: "Other",
         fields: [
            { id: 'title', label: 'Title', type: 'text', isTitle: true },
            { id: 'description', label: 'Description', type: 'textarea' }
        ]
    }
};