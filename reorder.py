import re

def process_file(filepath, font_size_pattern, new_font_size, ownership_start_marker, ownership_end_marker, insertion_marker):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # 1. Font size
    content = re.sub(font_size_pattern, new_font_size, content)
    
    # 2. Extract Ownership
    start_idx = content.find(ownership_start_marker)
    if start_idx == -1:
        print("Start marker not found in", filepath)
        return
    end_idx = content.find(ownership_end_marker, start_idx) + len(ownership_end_marker)
    
    ownership_block = content[start_idx:end_idx]
    
    # Remove ownership block
    content = content[:start_idx] + content[end_idx:]
    
    # Insert at insertion marker
    ins_idx = content.find(insertion_marker)
    if ins_idx == -1:
        print("Insertion marker not found in", filepath)
        return
        
    content = content[:ins_idx] + "\n" + ownership_block + "\n" + content[ins_idx:]
    
    # Write back
    with open(filepath, 'w') as f:
        f.write(content)
    print("Successfully processed", filepath)

process_file(
    "client/src/components/ProductDetailPage.tsx",
    r"fontSize: '2\.2rem'", 
    "fontSize: '1.8rem'",
    "                    {/* Ownership */}",
    "                    </div>",
    "                </div>\n            </div>\n\n            {/* Delete Confirmation Modal */}"
)

process_file(
    "client/src/components/ProductDetailModal.tsx",
    r"fontSize: 24", 
    "fontSize: 20",
    "                    {/* Ownership */}",
    "                    </Section>",
    "                        {/* Expanded Ticket List */}"
)

process_file(
    "client/src/components/ProductDetailModal.tsx",
    r"marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba\(255,255,255,0\.06\)'",
    "marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)'",
    "                    {/* Ownership */}", # It's already moved, won't do anything since we'll change insertion to the very end
    "dummy",
    "dummy"
)

