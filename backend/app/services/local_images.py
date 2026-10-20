# Demo photos are served from our own server: foreign image hosts load slowly or not at all from Uzbekistan
LOCAL_IMAGES = {
    "https://images.unsplash.com/photo-1488477181946-6428a0291777": "/img/p/277862b0db1e.jpg",
    "https://images.unsplash.com/photo-1508061253366-f7da158b6d46": "/img/p/b8482394d190.jpg",
    "https://images.unsplash.com/photo-1509440159596-0249088772ff": "/img/p/c80a567e0427.jpg",
    "https://images.unsplash.com/photo-1519996529931-28324d5a630e": "/img/p/7bf02d606f32.jpg",
    "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7": "/img/p/1b2087837e43.jpg",
    "https://images.unsplash.com/photo-1537640538966-79f369143f8f": "/img/p/5a4d0e8441f1.jpg",
    "https://images.unsplash.com/photo-1540420773420-3366772f4999": "/img/p/da60021c8357.jpg",
    "https://images.unsplash.com/photo-1542838132-92c53300491e": "/img/p/b2fb288e8c9b.jpg",
    "https://images.unsplash.com/photo-1544025162-d76694265947": "/img/p/2f16365da1c7.jpg",
    "https://images.unsplash.com/photo-1549931319-a545dcf3bc73": "/img/p/e2a4a96179e5.jpg",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1": "/img/p/d8695acbd883.jpg",
    "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6": "/img/p/5a48259cf19d.jpg",
    "https://images.unsplash.com/photo-1563636619-e9143da7973b": "/img/p/472bada752de.jpg",
    "https://images.unsplash.com/photo-1586444248902-2f64eddc13df": "/img/p/f3cdfa490b92.jpg",
    "https://images.unsplash.com/photo-1588168333986-5078d3ae3976": "/img/p/9dbbb0f54890.jpg",
    "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d": "/img/p/f991ce606410.jpg",
    "https://images.unsplash.com/photo-1592924357228-91a4daadcfea": "/img/p/66ff63f3f334.jpg",
    "https://images.unsplash.com/photo-1595855759920-86582396756a": "/img/p/8fe62a117e16.jpg",
    "https://images.unsplash.com/photo-1596560548464-f010549b84d7": "/img/p/429e5113495f.jpg",
    "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37": "/img/p/0d5709e58ccf.jpg",
    "https://images.unsplash.com/photo-1604977042946-1eecc30f269e": "/img/p/4271ff3ee73d.jpg",
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f": "/img/p/ef38b94878f0.jpg",
    "https://images.unsplash.com/photo-1610348725531-843dff563e2c": "/img/p/628eb6dfa087.jpg",
    "https://images.unsplash.com/photo-1618375569909-3c8616cf7733": "/img/p/f9450a36fb0a.jpg",
    "https://images.unsplash.com/photo-1619566636858-adf3ef46400b": "/img/p/29744c5f3ea2.jpg",
    "https://images.unsplash.com/photo-1628088062854-d1870b4553da": "/img/p/7a43768987ea.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Turkey_dried_apricots.jpg/960px-Turkey_dried_apricots.jpg": "/img/p/121388a51603.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/35/Central_Asian_Plov_Centre_in_Tashkent.jpg/960px-Central_Asian_Plov_Centre_in_Tashkent.jpg": "/img/p/f7d1f8adf261.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Samsa_of_Khiva.jpg/960px-Samsa_of_Khiva.jpg": "/img/p/e5aa614c5230.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Sunmaid-Raisin-Pile.jpg/960px-Sunmaid-Raisin-Pile.jpg": "/img/p/21420513c347.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Melon_product.jpg/960px-Melon_product.jpg": "/img/p/d2ef82ecd095.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Autumn_Red_peaches.jpg/960px-Autumn_Red_peaches.jpg": "/img/p/3306293db993.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Labneh_%285196911587%29.jpg/960px-Labneh_%285196911587%29.jpg": "/img/p/7e7a98810178.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Uzbekistan_style_plov_in_Japan.jpg/960px-Uzbekistan_style_plov_in_Japan.jpg": "/img/p/a7c6eb736091.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Pomegranate_fruit_-_whole_and_piece_with_arils.jpg/960px-Pomegranate_fruit_-_whole_and_piece_with_arils.jpg": "/img/p/31ff12118b99.jpg",
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/White_walnut_kernels.jpg/960px-White_walnut_kernels.jpg": "/img/p/4474d3c91c5b.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/5/5b/%27Horse_meat_sausages%27_in_Chorsu_Bazaar.jpg": "/img/p/3aa19f321d73.jpg",
}


def local_image(url):
    """Our copy of a known external demo photo, else the URL unchanged."""
    if not url:
        return url
    return LOCAL_IMAGES.get(url.split("?", 1)[0], url)
