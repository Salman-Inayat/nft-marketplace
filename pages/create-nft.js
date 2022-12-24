import { useState } from "react";
import { ethers } from "ethers";
import { create as ipfsHttpClient } from "ipfs-http-client";
import { useRouter } from "next/router";
import Web3Modal from "web3modal";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";

// const client = ipfsHttpClient(`https://ipfs.infura.io:5001/api/v0`);

import { marketplaceAddress } from "../config";
import NFTMarketplace from "../artifacts/contracts/NFTMarket.sol/NFTMarketplace.json";

const client = ipfsHttpClient({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: `Basic ${Buffer.from(
      process.env.NEXT_PUBLIC_INFURA_IPFS_PROJECT_ID +
        ":" +
        process.env.NEXT_PUBLIC_INFURA_IPFS_SECRET_KEY
    ).toString("base64")}`,
  },
});

const CreateItem = () => {
  const [fileUrl, setFileUrl] = useState(null);
  const router = useRouter();

  const CreateNFTSchema = Yup.object().shape({
    name: Yup.string().required("Name is required"),
    description: Yup.string().required("Description is required"),
    price: Yup.string().required("Price is required"),
    imageUrl: Yup.string().required("Image is required"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(CreateNFTSchema),
  });

  async function uploadImageToIPFS(e) {
    /* upload image to IPFS */
    const file = e.target.files[0];
    try {
      const added = await client.add(file, {
        progress: (prog) => console.log(`received: ${prog}`),
      });
      console.log({ added });
      const url = `https://nfts-market.infura-ipfs.io/ipfs/${added.path}`;
      setFileUrl(url);
    } catch (error) {
      console.log("Error uploading file: ", error);
    }
  }

  async function uploadToIPFS(formData) {
    const { name, description, price } = formData;

    /* first, upload metadata to IPFS */
    const data = JSON.stringify({
      name,
      description,
      image: fileUrl,
    });
    try {
      const added = await client.add(data);
      const url = `https://nfts-market.infura-ipfs.io/ipfs/${added.path}`;
      /* after metadata is uploaded to IPFS, return the URL to use it in the transaction */
      return url;
    } catch (error) {
      console.log("Error uploading file: ", error);
    }
  }

  async function listNFTForSale(data) {
    const url = await uploadToIPFS(data);
    const web3 = new Web3Modal();
    const connection = await web3.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();

    /* create the NFT */
    const price = ethers.utils.parseUnits(data.price, "ether");
    let contract = new ethers.Contract(
      marketplaceAddress,
      NFTMarketplace.abi,
      signer
    );
    let listingPrice = await contract.getListingPrice();
    listingPrice = listingPrice.toString();
    let transaction = await contract.createToken(url, price, {
      value: listingPrice,
    });
    await transaction.wait();

    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit(listNFTForSale)}>
      <div className="flex justify-center">
        <div className="w-1/2 flex flex-col pb-12">
          <input
            placeholder="Asset Name"
            className="mt-8 border rounded p-4"
            {...register("name")}
          />
          <span className="text-red-500 text-sm">{errors?.name?.message}</span>
          <textarea
            placeholder="Asset Description"
            className="mt-2 border rounded p-4"
            {...register("description")}
          />
          <span className="text-red-500 text-sm">
            {errors?.description?.message}
          </span>

          <input
            placeholder="Asset Price in Eth"
            className="mt-2 border rounded p-4"
            {...register("price")}
          />
          <span className="text-red-500 text-sm">{errors?.price?.message}</span>

          <input
            type="file"
            accept="image/*"
            className="my-4"
            {...register("imageUrl")}
            onChange={uploadImageToIPFS}
          />
          <span className="text-red-500 text-sm">
            {errors?.imageUrl?.message}
          </span>

          {fileUrl && (
            <img className="rounded mt-4" width="350" src={fileUrl} />
          )}
          <button
            type="submit"
            className="font-bold mt-4 bg-pink-500 text-white rounded p-4 shadow-lg"
          >
            Create NFT
          </button>
        </div>
      </div>
    </form>
  );
};

export default CreateItem;
