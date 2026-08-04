from pathlib import Path

path = Path('src/preview/renderers/FormBlocks.jsx')
text = path.read_text(encoding='utf-8-sig')
old = "    } catch (submitError) {\n      const isDuplicate = [409, 429].includes(Number(submitError?.status || 0));\n      setError(isDuplicate ? '이미 접수된 정보입니다. 다른 연락처로 다시 시도해주세요.' : '예약 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');\n      setSubmitting(false);\n      return;\n    }"
new = "    } catch (submitError) {\n      const status = Number(submitError?.status || 0);\n      setError(status === 409\n        ? '이미 접수된 연락처입니다. 입력한 연락처를 확인해주세요.'\n        : status === 429\n          ? '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.'\n          : '예약 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');\n      setSubmitting(false);\n      return;\n    }"
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one reservation error block, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Applied reservation duplicate and throttling message split.')
