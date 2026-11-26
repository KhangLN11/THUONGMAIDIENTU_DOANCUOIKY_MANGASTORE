"""Read-only pixel comparison for Chrome PNG screenshots (stdlib only)."""
from pathlib import Path
import struct,zlib,json,sys

def read_png(path):
 data=Path(path).read_bytes();pos=8;compressed=b''
 while pos<len(data):
  n=struct.unpack('>I',data[pos:pos+4])[0];kind=data[pos+4:pos+8];value=data[pos+8:pos+8+n];pos+=12+n
  if kind==b'IHDR':width,height,depth,color,*_=struct.unpack('>IIBBBBB',value)
  if kind==b'IDAT':compressed+=value
 assert depth==8 and color in (2,6)
 channels=3 if color==2 else 4;stride=width*channels;raw=zlib.decompress(compressed);rows=[];previous=bytearray(stride);offset=0
 for y in range(height):
  filter_type=raw[offset];offset+=1;row=bytearray(raw[offset:offset+stride]);offset+=stride
  for x in range(stride):
   a=row[x-channels] if x>=channels else 0;b=previous[x];c=previous[x-channels] if x>=channels else 0
   if filter_type==1:row[x]=(row[x]+a)&255
   elif filter_type==2:row[x]=(row[x]+b)&255
   elif filter_type==3:row[x]=(row[x]+((a+b)//2))&255
   elif filter_type==4:
    p=a+b-c;aa=abs(p-a);bb=abs(p-b);cc=abs(p-c);row[x]=(row[x]+(a if aa<=bb and aa<=cc else b if bb<=cc else c))&255
  rows.append(row);previous=row
 return width,height,channels,rows

def compare(first,second):
 w,h,c,a=read_png(first);w2,h2,c2,b=read_png(second);assert (w,h,c)==(w2,h2,c2)
 minx=w;miny=h;maxx=maxy=-1;count=0
 for y in range(h):
  for x in range(w):
   if a[y][x*c:x*c+c]!=b[y][x*c:x*c+c]:minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y);count+=1
 return {'pixels':count,'bbox':[minx,miny,maxx,maxy] if count else None}
if __name__=='__main__':print(json.dumps(compare(sys.argv[1],sys.argv[2])))
