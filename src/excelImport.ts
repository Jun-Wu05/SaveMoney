import type { ImportedBill } from './csvImport'
import type { CsvImportPreview } from './csvImport'

type Cell = string | number | Date | null | undefined
const headers = ['日期','类型','分类','备注','收入（元）','支出（元）','结余（元）']
function dateValue(value: Cell): string {
  if (value instanceof Date) return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-')
  return String(value ?? '').trim()
}
function moneyMinor(value: Cell): number | null {
  if (value === null || value === undefined || value === '') return 0
  const raw = String(value).trim()
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw)) return null
  const [whole,decimal=''] = raw.split('.')
  return Number(whole)*100 + Number(decimal.padEnd(2,'0'))
}
export function parseMonthlyRows(rows: Cell[][], sheet: string): CsvImportPreview {
  if (!rows.length || headers.some((header,i)=>String(rows[0][i]??'').trim()!==header)) throw new Error(`${sheet} 表头不符合 SaveMoney 格式`)
  const bills: ImportedBill[] = [], errors: CsvImportPreview['errors'] = []
  for(let i=1;i<rows.length;i++){
    const row=rows[i]
    const date=dateValue(row[0]), type=String(row[1]??'').trim()
    if (!row.some(cell=>cell!==null&&cell!==undefined&&String(cell).trim())) continue
    if (date==='月度合计') continue
    const category=String(row[2]??'').trim(), note=String(row[3]??'').trim()
    const income=moneyMinor(row[4]), expense=moneyMinor(row[5])
    const [y,m,d]=date.split('-').map(Number)
    const actual=new Date(0);actual.setFullYear(y,m-1,d)
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||actual.getFullYear()!==y||actual.getMonth()!==m-1||actual.getDate()!==d||
       !['收入','支出'].includes(type)||!category||category.length>40||note.length>200||income===null||expense===null||
       (type==='收入' ? income<=0||expense!==0 : expense<=0||income!==0)){
      errors.push({line:i+1,message:`${sheet} 工作表存在无效记录`});continue
    }
    bills.push({date,type:type==='收入'?'income':'expense',amountMinor:type==='收入'?income!:expense!,category,note})
  }
  return {rows:bills,errors}
}
export async function parseSaveMoneyExcel(file: File): Promise<CsvImportPreview> {
  const {default:readXlsxFile,readSheetNames}=await import('read-excel-file/browser')
  const names=await readSheetNames(file)
  const months=names.filter(name=>/^\d{4}-(0[1-9]|1[0-2])$/.test(name))
  if(!months.length)throw new Error('没有找到 SaveMoney 月度工作表')
  const result: CsvImportPreview={rows:[],errors:[]}
  for(const month of months){
    const data=await readXlsxFile(file,{sheet:month})
    const parsed=parseMonthlyRows(data as Cell[][],month)
    result.rows.push(...parsed.rows);result.errors.push(...parsed.errors)
    if(result.rows.length>100000)throw new Error('Excel 记录过多')
  }
  return result
}
