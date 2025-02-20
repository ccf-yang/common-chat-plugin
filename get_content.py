import os
import glob

current_dir = os.path.dirname(os.path.abspath(__file__))
result = ''
for file in glob.glob(os.path.join(current_dir, '**'), recursive=True): 
    end_str = file.split('.')[-1]
    if end_str in ['py', 'json', 'md', 'txt', 'png', '']:
        continue
    if os.path.isdir(file):
        continue

    filename = file.split('\\')[-1]
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    result += f"filename: {filename} \ncontent:\n```{content}```\n\n"

with open('result.txt', 'w', encoding='utf-8') as f:
    f.write(result)

