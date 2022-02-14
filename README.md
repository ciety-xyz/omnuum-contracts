## Summary


There are a lot of NFT projects and PFP projects. But, there are limited tools and services for trying new project. Artists or creator whoever want to launch a new project needs several resources. FE developer, BE developer, DApp Developer, Artists, NFT image maker etc. To lowering entry barrier and encourage NFT projects for everyone, we are building those tools.

Core contracts are NFT token and complex mint managing contract. NFT token contract is based on ERC1155 with little changes and mint managing contract is literally managing whitelists for NFT contract. These are similar to previous NFT, PFP projects except reusability. Our goal is to build tool, so NFT token contracts have to be deployed multiple times for each projects. Also mint managing contract should continuously be updated to support additional features to fulfill growing needs of projects. In this documents, there are detail implementation and methods, plans for above goal.


## Project Setting


```shell
npm install
```

## Testing


- 70~80% of test is completed.

- test command

```shell
npx hardhat node
npx hardhat test
```


## References

- [Omnuum.io](https://omnuum.io/)
- [Docs](https://www.omnuum.page/)
