import { useId, useState } from "react";
import { useI18n } from "../../i18n";
import type { Product } from "../../types/product";
import {copy,specifications} from "./productInformation";
import "./product-info-accordion.css";
export function ProductInfoAccordion({product}:{product:Product}) {
 const {language}=useI18n();
 const content=copy[language];
 const [open,setOpen]=useState<boolean[]>([false,false,false]);
 const id=useId();
 return <div className="accordions product-information" data-product-text="true">
  {content.titles.map((title,index)=><div className="product-info-item" key={index}>
   <button type="button" id={`${id}-trigger-${index}`} aria-expanded={open[index]} aria-controls={`${id}-panel-${index}`} onClick={()=>setOpen(v=>v.map((x,i)=>i===index?!x:x))}>
    {title}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14"/>{!open[index]&&<path d="M12 5v14"/>}</svg>
   </button>
   <div className="product-info-panel" id={`${id}-panel-${index}`} role="region" aria-labelledby={`${id}-trigger-${index}`} aria-hidden={!open[index]} inert={!open[index]} data-open={open[index]}>
    <div className="product-info-clip"><div className="product-info-content">
    {index===0?<><dl>{specifications(product,language).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>{content.description}</h3><p>{product.description||content.noDescription}</p><p className="product-info-note">{content.missing}</p></>:content[index===1?"shipping":"authenticity"].map(([heading,text])=><section key={heading}><h3>{heading}</h3><p>{text}</p></section>)}
    </div></div>
   </div>
  </div>)}
 </div>;
}
