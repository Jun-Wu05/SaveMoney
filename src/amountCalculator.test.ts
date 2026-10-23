import { describe,expect,it } from 'vitest'
import { calculateAmount, finalizeAmount } from './amountCalculator'
describe('integer-cent entry calculator',()=>{
  it('adds and subtracts decimal amounts',()=>{
    expect(calculateAmount({baseMinor:2500,operator:'+'},'25')).toEqual({amountMinor:5000,display:'50.00'})
    expect(calculateAmount({baseMinor:10000,operator:'-'},'35')).toEqual({amountMinor:6500,display:'65.00'})
    expect(calculateAmount({baseMinor:1250,operator:'+'},'7.5')).toEqual({amountMinor:2000,display:'20.00'})
  })
  it('chains results without floating-point drift',()=>{
    const first=calculateAmount({baseMinor:2000,operator:'+'},'5')
    if('error' in first) throw new Error(first.error)
    expect(calculateAmount({baseMinor:first.amountMinor,operator:'+'},'10')).toEqual({amountMinor:3500,display:'35.00'})
  })
  it('rejects zero/negative/invalid amounts',()=>{
    expect(calculateAmount({baseMinor:2000,operator:'-'},'20')).toHaveProperty('error')
    expect(calculateAmount({baseMinor:2000,operator:'-'},'25')).toHaveProperty('error')
    expect(calculateAmount(null,'abc')).toHaveProperty('error')
    expect(calculateAmount(null,'')).toHaveProperty('error')
  })
  it('limits amount to accepted entry precision',()=>{
    expect(calculateAmount({baseMinor:99999999900,operator:'+'},'1')).toHaveProperty('error')
  })
})

describe('saving with unfinished operator', () => {
  it('saves base amount when user taps plus but never enters a second number', () => {
    expect(finalizeAmount({baseMinor:11000,operator:'+'},'')).toEqual({amountMinor:11000,display:'110.00'})
    expect(finalizeAmount({baseMinor:11000,operator:'-'},'')).toEqual({amountMinor:11000,display:'110.00'})
  })
  it('calculates normally when the second amount is entered', () => {
    expect(finalizeAmount({baseMinor:11000,operator:'+'},'5')).toEqual({amountMinor:11500,display:'115.00'})
  })
  it('rejects truly empty entries', () => {
    expect(finalizeAmount(null,'')).toHaveProperty('error')
  })
})
