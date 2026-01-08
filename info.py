import os

def count_lines(directory, extensions):
    total_lines = 0
    file_counts = []

    for root, dirs, files in os.walk(directory):
        # 跳过node_modules目录（可选）
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        
        for file in files:
            if os.path.splitext(file)[1].lower() in extensions:
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = sum(1 for line in f)
                        total_lines += lines
                        file_counts.append((file_path, lines))
                except Exception as e:
                    print(f"无法读取文件 {file_path}: {e}")

    return file_counts, total_lines

if __name__ == "__main__":
    target_dir = os.path.join(os.getcwd(), 'src')
    file_extensions = {'.ts', '.tsx'}  # 可以扩展其他后缀

    if not os.path.exists(target_dir):
        print(f"错误：目录 {target_dir} 不存在")
        exit(1)

    files, total = count_lines(target_dir, file_extensions)

    print("\n代码统计结果：")
    for path, count in files:
        print(f"{path}: {count} 行")

    print(f"\n总代码行数: {total} 行")